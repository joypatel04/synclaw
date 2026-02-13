import type { BridgeConfig } from "./config.js";
import { BridgeConvexClient } from "./convex-client.js";
import { GatewayClient } from "./gateway-client.js";
import { mapGatewayEventToIngestInput } from "./mapper.js";

type OutboxItem = {
  _id: string;
  commandType: "chat.send" | "chat.abort";
  sessionKey: string;
  payload?: { content?: string; externalRunId?: string };
  clientMessageId: string;
};

type ChatSendResponse = Record<string, unknown>;
type HistoryMessage = {
  id?: string;
  messageId?: string;
  runId?: string;
  role?: string;
  author?: string;
  content?: string;
  text?: string;
  message?: string;
  reply?: string;
  createdAt?: number;
  ts?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function findText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const t = findText(entry);
      if (t) return t;
    }
    return null;
  }
  const obj = asRecord(value);
  if (!obj) return null;
  for (const key of ["reply", "message", "content", "text", "outputText"]) {
    const t = findText(obj[key]);
    if (t) return t;
  }
  return null;
}

function findRunId(value: unknown): string | undefined {
  const obj = asRecord(value);
  if (!obj) return undefined;
  const direct = obj.runId;
  if (typeof direct === "string" && direct.length > 0) return direct;
  for (const key of ["data", "result", "payload"]) {
    const nested = findRunId(obj[key]);
    if (nested) return nested;
  }
  return undefined;
}

function pickHistoryMessages(history: unknown): HistoryMessage[] {
  const obj = asRecord(history);
  if (!obj) return [];

  const candidates = [
    obj.messages,
    obj.items,
    asRecord(obj.data)?.messages,
    asRecord(obj.result)?.messages,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((m) => !!asRecord(m)) as HistoryMessage[];
    }
  }

  return [];
}

export class OpenClawBridgeWorker {
  private convex: BridgeConvexClient;
  private gateway: GatewayClient;
  private shuttingDown = false;
  private reconnectMs: number;

  constructor(private config: BridgeConfig) {
    this.convex = new BridgeConvexClient({
      convexUrl: config.convexUrl,
      convexSiteUrl: config.convexSiteUrl,
      apiKey: config.sutrahaApiKey,
      workspaceId: config.workspaceId,
    });
    this.gateway = new GatewayClient(config, async (event) => {
      const fallbackEventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const mapped = mapGatewayEventToIngestInput(event, fallbackEventId);
      if (!mapped) return;

      await this.convex.mutation("chatIngest:upsertGatewayEvent", {
        sessionKey: mapped.sessionKey,
        eventId: mapped.eventId,
        eventType: mapped.eventType,
        eventAt: mapped.eventAt,
        payload: mapped.payload,
        message: mapped.message,
        sessionStatus: mapped.sessionStatus,
        openclawSessionId: mapped.openclawSessionId,
      });
    });
    this.reconnectMs = config.reconnectMinMs;
  }

  async start() {
    while (!this.shuttingDown) {
      try {
        await this.gateway.connect();
        this.reconnectMs = this.config.reconnectMinMs;
        await this.pollLoop();
      } catch (error) {
        if (this.shuttingDown) break;
        console.error("Bridge connection/poll error:", error);
        await sleep(this.reconnectMs + Math.floor(Math.random() * 250));
        this.reconnectMs = Math.min(
          this.config.reconnectMaxMs,
          Math.max(this.config.reconnectMinMs, this.reconnectMs * 2),
        );
      }
    }
  }

  async stop() {
    this.shuttingDown = true;
    await this.gateway.disconnect();
  }

  private async pollLoop() {
    while (!this.shuttingDown) {
      const claimed = (await this.convex.mutation("chatOutbox:claimBatch", {
        workerId: this.config.workerId,
        limit: this.config.batchSize,
      })) as OutboxItem[];

      for (const item of claimed) {
        try {
          if (item.commandType === "chat.send") {
            const sendResult = (await this.gateway.sendChat({
              sessionKey: item.sessionKey,
              content: String(item.payload?.content ?? ""),
              clientMessageId: item.clientMessageId,
            })) as ChatSendResponse;

            await this.ingestUserCompletion(item);
            await this.ingestAssistantReply(item, sendResult);
          } else if (item.commandType === "chat.abort") {
            await this.gateway.abortChat({
              sessionKey: item.sessionKey,
              runId: String(item.payload?.externalRunId ?? ""),
              clientMessageId: item.clientMessageId,
            });
          } else {
            throw new Error(`Unsupported commandType: ${item.commandType}`);
          }

          await this.convex.mutation("chatOutbox:markSent", {
            outboxId: item._id,
            clientMessageId: item.clientMessageId,
          });
        } catch (error) {
          await this.convex.mutation("chatOutbox:markFailed", {
            outboxId: item._id,
            error:
              error instanceof Error ? error.message : "Unknown bridge error",
          });
        }
      }

      await sleep(this.config.pollIntervalMs);
    }
  }

  private async ingestUserCompletion(item: OutboxItem) {
    const content = String(item.payload?.content ?? "");
    await this.convex.mutation("chatIngest:upsertGatewayEvent", {
      sessionKey: item.sessionKey,
      eventId: `evt_ack_user_${item.clientMessageId}`,
      eventType: "chat.send.ack.user",
      payload: { outboxId: item._id, clientMessageId: item.clientMessageId },
      message: {
        externalMessageId: item.clientMessageId,
        role: "user",
        fromUser: true,
        content,
        state: "completed",
      },
      sessionStatus: "active",
    });
  }

  private async ingestAssistantReply(
    item: OutboxItem,
    sendResult: ChatSendResponse,
  ) {
    const runId = findRunId(sendResult);
    const directReply = findText(sendResult);
    if (directReply) {
      await this.convex.mutation("chatIngest:upsertGatewayEvent", {
        sessionKey: item.sessionKey,
        eventId: `evt_ack_assistant_${item.clientMessageId}`,
        eventType: "chat.send.ack.assistant",
        payload: sendResult,
        message: {
          externalMessageId: runId
            ? `${runId}:assistant`
            : `${item.clientMessageId}:assistant`,
          externalRunId: runId,
          role: "assistant",
          fromUser: false,
          content: directReply,
          state: "completed",
        },
        sessionStatus: "idle",
      });
      return;
    }

    // Fallback for gateway variants without subscribe stream support.
    for (const delayMs of [1000, 2500, 5000]) {
      await sleep(delayMs);
      try {
        const history = await this.gateway.getChatHistory({
          sessionKey: item.sessionKey,
          limit: 20,
        });
        const messages = pickHistoryMessages(history);
        const assistant = messages
          .slice()
          .reverse()
          .find((m) => {
            const role =
              typeof m.role === "string"
                ? m.role
                : typeof m.author === "string"
                  ? m.author
                  : "assistant";
            return role !== "user";
          });
        const reply =
          findText(assistant?.reply) ??
          findText(assistant?.message) ??
          findText(assistant?.content) ??
          findText(assistant?.text);
        if (!reply) continue;

        const histRunId =
          (typeof assistant?.runId === "string" && assistant.runId) || runId;
        const histMessageId =
          (typeof assistant?.messageId === "string" && assistant.messageId) ||
          (typeof assistant?.id === "string" && assistant.id) ||
          (histRunId
            ? `${histRunId}:assistant`
            : `${item.clientMessageId}:assistant`);

        await this.convex.mutation("chatIngest:upsertGatewayEvent", {
          sessionKey: item.sessionKey,
          eventId: `evt_hist_assistant_${item.clientMessageId}_${delayMs}`,
          eventType: "chat.history.assistant",
          payload: asRecord(history) ?? {},
          message: {
            externalMessageId: histMessageId,
            externalRunId: histRunId,
            role: "assistant",
            fromUser: false,
            content: reply,
            state: "completed",
          },
          sessionStatus: "idle",
        });
        return;
      } catch (error) {
        console.warn("chat.history fallback failed:", error);
      }
    }
  }
}
