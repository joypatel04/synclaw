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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
            await this.gateway.sendChat({
              sessionKey: item.sessionKey,
              content: String(item.payload?.content ?? ""),
              clientMessageId: item.clientMessageId,
            });
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
}
