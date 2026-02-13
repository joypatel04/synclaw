export type GatewayProtocol = "req" | "jsonrpc";

type GatewayMessage = Record<string, unknown>;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type GatewayClientConfig = {
  wsUrl: string;
  protocol: GatewayProtocol;
  authToken?: string;
  password?: string;
  clientId: string;
  clientMode: string;
  clientPlatform: string;
  role: string;
  scopes: string[];
  subscribeOnConnect: boolean;
  subscribeMethod: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function pickText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = pickText(entry);
      if (found) return found;
    }
    return null;
  }
  const obj = asRecord(value);
  if (!obj) return null;
  for (const key of ["reply", "message", "content", "text", "outputText"]) {
    const found = pickText(obj[key]);
    if (found) return found;
  }
  return null;
}

export function pickRunId(value: unknown): string | undefined {
  const obj = asRecord(value);
  if (!obj) return undefined;
  const direct = obj.runId;
  if (typeof direct === "string" && direct.length > 0) return direct;
  for (const key of ["data", "result", "payload"]) {
    const nested = pickRunId(obj[key]);
    if (nested) return nested;
  }
  return undefined;
}

export type HistoryMessage = Record<string, unknown>;

export function pickHistoryMessages(history: unknown): HistoryMessage[] {
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

export function pickLatestAssistantFromHistory(history: unknown): {
  text: string;
  runId?: string;
  messageId?: string;
} | null {
  const messages = pickHistoryMessages(history);
  if (messages.length === 0) return null;

  const assistant = messages
    .slice()
    .reverse()
    .find((m) => {
      const role =
        (typeof m.role === "string" && m.role) ||
        (typeof m.author === "string" && m.author) ||
        "assistant";
      return role !== "user";
    });
  if (!assistant) return null;

  const text =
    pickText(assistant.reply) ??
    pickText(assistant.message) ??
    pickText(assistant.content) ??
    pickText(assistant.text);
  if (!text) return null;

  const runId = typeof assistant.runId === "string" ? assistant.runId : undefined;
  const messageId =
    (typeof assistant.messageId === "string" && assistant.messageId) ||
    (typeof assistant.id === "string" && assistant.id) ||
    undefined;

  return { text, runId, messageId };
}

export type IngestMappedEvent = {
  sessionKey: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  eventAt?: number;
  sessionStatus?: "active" | "idle" | "error" | "closed";
  openclawSessionId?: string;
  message?: {
    externalMessageId: string;
    externalRunId?: string;
    role: "user" | "assistant" | "system" | "tool";
    fromUser: boolean;
    content?: string;
    append?: boolean;
    state?:
      | "queued"
      | "sending"
      | "streaming"
      | "completed"
      | "failed"
      | "aborted";
    errorCode?: string;
    errorMessage?: string;
  };
};

function mapStatusToMessageState(
  status: unknown,
): NonNullable<IngestMappedEvent["message"]>["state"] {
  if (status === "completed" || status === "done") return "completed";
  if (status === "failed" || status === "error") return "failed";
  if (status === "aborted" || status === "cancelled") return "aborted";
  if (status === "queued") return "queued";
  if (status === "sending") return "sending";
  return "streaming";
}

export function mapGatewayEventForIngest(
  raw: GatewayMessage,
  fallbackEventId: string,
): IngestMappedEvent | null {
  const sessionKey =
    (typeof raw.sessionKey === "string" && raw.sessionKey) ||
    (typeof raw.session === "string" && raw.session) ||
    (typeof raw.sessionId === "string" && raw.sessionId);
  if (!sessionKey) return null;

  const eventType =
    (typeof raw.type === "string" && raw.type) ||
    (typeof raw.event === "string" && raw.event) ||
    (typeof raw.name === "string" && raw.name) ||
    "unknown";

  const eventId =
    (typeof raw.id === "string" && raw.id) ||
    (typeof raw.eventId === "string" && raw.eventId) ||
    fallbackEventId;

  const runId = typeof raw.runId === "string" ? raw.runId : undefined;
  const content =
    (typeof raw.delta === "string" && raw.delta) ||
    (typeof raw.content === "string" && raw.content) ||
    (typeof raw.reply === "string" && raw.reply) ||
    undefined;

  const roleRaw =
    (typeof raw.role === "string" && raw.role) ||
    (typeof raw.author === "string" && raw.author) ||
    "assistant";
  const role: "user" | "assistant" | "system" | "tool" =
    roleRaw === "user" ||
    roleRaw === "assistant" ||
    roleRaw === "system" ||
    roleRaw === "tool"
      ? roleRaw
      : "assistant";

  const fromUser = role === "user";
  const messageId =
    (typeof raw.messageId === "string" && raw.messageId) ||
    (runId ? `${runId}:assistant` : `${sessionKey}:${eventId}`);

  const isMessageEvent =
    eventType.includes("chat") ||
    eventType.includes("message") ||
    content !== undefined ||
    runId !== undefined;

  return {
    sessionKey,
    eventId,
    eventType,
    payload: raw,
    message: isMessageEvent
      ? {
          externalMessageId: messageId,
          externalRunId: runId,
          role,
          fromUser,
          content,
          append: typeof raw.delta === "string",
          state: mapStatusToMessageState(raw.status),
          errorMessage: typeof raw.error === "string" ? raw.error : undefined,
        }
      : undefined,
    sessionStatus:
      raw.status === "failed" || raw.status === "error"
        ? "error"
        : raw.status === "completed" || raw.status === "done"
          ? "idle"
          : undefined,
    openclawSessionId:
      typeof raw.sessionId === "string" ? raw.sessionId : undefined,
  };
}

export class OpenClawBrowserGatewayClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<string, PendingRequest>();

  constructor(
    private config: GatewayClientConfig,
    private onEvent: (event: GatewayMessage) => Promise<void>,
  ) {}

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.config.wsUrl);
      this.ws = ws;

      ws.addEventListener("open", () => {
        void (async () => {
          try {
            await this.request("connect", {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: this.config.clientId,
                version: "0.1.0",
                mode: this.config.clientMode,
                platform: this.config.clientPlatform,
              },
              role: this.config.role,
              scopes: this.config.scopes,
              locale: "en-US",
              auth: {
                token: this.config.authToken,
                password: this.config.password,
              },
            });

            if (this.config.subscribeOnConnect) {
              try {
                await this.request(this.config.subscribeMethod, {});
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : String(error);
                if (!message.includes("unknown method")) throw error;
              }
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        })();
      });

      ws.addEventListener("message", (event) => {
        void (async () => {
          try {
            const parsed = JSON.parse(String(event.data)) as GatewayMessage;
            const responseId =
              typeof parsed.id === "string"
                ? parsed.id
                : typeof parsed.id === "number"
                  ? String(parsed.id)
                  : null;

            if (
              responseId &&
              (parsed.result !== undefined ||
                parsed.error !== undefined ||
                parsed.ok !== undefined)
            ) {
              const pending = this.pending.get(responseId);
              if (!pending) return;
              clearTimeout(pending.timeout);
              this.pending.delete(responseId);

              if (parsed.error || parsed.ok === false) {
                pending.reject(new Error(JSON.stringify(parsed.error)));
              } else {
                pending.resolve(parsed.result ?? parsed);
              }
              return;
            }

            await this.onEvent(parsed);
          } catch (error) {
            console.warn("Gateway event parse/handler error:", error);
          }
        })();
      });

      ws.addEventListener("error", () => reject(new Error("WS connection error")));
      ws.addEventListener("close", () => {
        this.ws = null;
        for (const [id, pending] of this.pending.entries()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(`Gateway socket closed (request ${id})`));
        }
        this.pending.clear();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (!this.ws) return;
    await new Promise<void>((resolve) => {
      this.ws?.addEventListener("close", () => resolve(), { once: true });
      this.ws?.close();
    });
  }

  async request(method: string, params: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway socket not connected");
    }

    const id = String(this.nextId++);
    const payload =
      this.config.protocol === "jsonrpc"
        ? { jsonrpc: "2.0", id, method, params }
        : { type: "req", id, method, params };

    return await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway request timeout: ${method}`));
      }, 20_000);

      this.pending.set(id, { resolve, reject, timeout });
      this.ws?.send(JSON.stringify(payload));
    });
  }

  async sendChat(params: {
    sessionKey: string;
    content: string;
    clientMessageId: string;
  }) {
    return await this.request("chat.send", {
      sessionKey: params.sessionKey,
      message: params.content,
      idempotencyKey: params.clientMessageId,
    });
  }

  async abortChat(params: {
    sessionKey: string;
    runId: string;
    clientMessageId: string;
  }) {
    return await this.request("chat.abort", {
      sessionKey: params.sessionKey,
      runId: params.runId,
      clientMessageId: params.clientMessageId,
    });
  }

  async getChatHistory(params: { sessionKey: string; limit?: number }) {
    return await this.request("chat.history", {
      sessionKey: params.sessionKey,
      limit: params.limit ?? 20,
    });
  }
}
