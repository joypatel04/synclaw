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

function isGatewayDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const flag = window.localStorage.getItem("sutraha:gatewayDebug");
    if (flag === "1" || flag === "true") return true;
  } catch {}
  return false;
}

function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => redactForLog(v));
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (
      k.toLowerCase().includes("token") ||
      k.toLowerCase().includes("password") ||
      k.toLowerCase().includes("secret")
    ) {
      out[k] = v ? "[REDACTED]" : v;
    } else {
      out[k] = redactForLog(v);
    }
  }
  return out;
}

function normalizeScopes(scopes: string[], role: string): string[] {
  const out = new Set(scopes.map((s) => s.trim()).filter(Boolean));
  if (out.size === 0) {
    out.add("operator.read");
    out.add("operator.write");
  }
  if (role === "operator") {
    out.add("operator.admin");
  }
  return Array.from(out);
}

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

  const payloadObj = asRecord(obj.payload);
  const payloadPayloadObj = payloadObj ? asRecord(payloadObj.payload) : null;

  const candidates = [
    obj.messages,
    obj.items,
    payloadObj?.messages,
    payloadObj?.items,
    payloadPayloadObj?.messages,
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

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function pickUsageLimit(usage: Record<string, unknown>, total: number): number | undefined {
  // Try common names for model context window / token limits.
  const candidates = [
    "contextWindow",
    "contextTokens",
    "maxContextTokens",
    "maxTokens",
    "tokenLimit",
    "limit",
    "capacity",
    "contextSize",
  ];
  for (const k of candidates) {
    const v = usage[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      // Only treat it as a "limit" if it is plausibly >= total.
      if (v >= total) return v;
    }
  }
  return undefined;
}

export function extractContextSizeFromHistory(history: unknown): string | null {
  // Best-effort: some gateways embed token usage + context limits on assistant messages.
  // If we can't find a limit, we still show total token usage.
  const messages = pickHistoryMessages(history);
  if (messages.length === 0) return null;

  const lastAssistant = messages
    .slice()
    .reverse()
    .find((m) => {
      const role =
        (typeof m.role === "string" && m.role) ||
        (typeof m.author === "string" && m.author) ||
        "assistant";
      return role === "assistant";
    });

  if (!lastAssistant) return null;
  const usage = asRecord((lastAssistant as any).usage);
  if (!usage) return null;

  const total =
    (typeof usage.totalTokens === "number" && usage.totalTokens) ||
    (typeof usage.total === "number" && usage.total) ||
    (typeof usage.tokens === "number" && usage.tokens) ||
    undefined;
  if (!total || !Number.isFinite(total)) return null;

  const limit = pickUsageLimit(usage, total);
  if (limit) return `context: ${formatNumber(total)}/${formatNumber(limit)}`;
  return `Tokens used: ${formatNumber(total)}`;
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
      return role === "assistant";
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

function hashString(input: string): string {
  // Simple deterministic hash for stable IDs; not cryptographic.
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export type HistoryIngestMessage = {
  externalMessageId: string;
  role: "user" | "assistant" | "system" | "tool";
  fromUser: boolean;
  content: string;
  state: "completed";
  eventAt?: number;
};

export function extractDisplayMessagesFromHistory(
  history: unknown,
): HistoryIngestMessage[] {
  const messages = pickHistoryMessages(history);
  if (messages.length === 0) return [];

  const joinTextParts = (parts: unknown[]): string | null => {
    const textParts = parts
      .filter((p: any) => p && typeof p === "object" && p.type === "text")
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
    return textParts.length > 0 ? textParts.join("\n\n") : null;
  };

  const out: HistoryIngestMessage[] = [];
  for (const m of messages) {
    const roleRaw =
      (typeof m.role === "string" && m.role) ||
      (typeof m.author === "string" && m.author) ||
      "assistant";

    // Skip toolResult here; we ingest exec cards via extractExecTracesFromHistory.
    if (roleRaw === "toolResult") continue;

    const role: "user" | "assistant" | "system" | "tool" =
      roleRaw === "user" || roleRaw === "assistant" || roleRaw === "system"
        ? roleRaw
        : roleRaw === "tool"
          ? "tool"
          : "assistant";

    // For assistant messages, keep only readable text parts (ignore thinking/toolCall parts).
    let text: string | null = null;
    if (role === "assistant" && Array.isArray(m.content)) {
      const textParts = m.content
        .filter((p: any) => p && typeof p === "object" && p.type === "text")
        .map((p: any) => (typeof p.text === "string" ? p.text : ""))
        .filter((t: string) => t.trim().length > 0);
      text = textParts.length > 0 ? textParts.join("\n") : null;
    } else if ((role === "user" || role === "system") && Array.isArray(m.content)) {
      // Some gateways store user/system content as multiple text parts. Prefer joining
      // them so markdown structure (headers/lists) is preserved.
      text = joinTextParts(m.content);
    } else {
      text =
        pickText(m.content) ??
        pickText(m.text) ??
        pickText(m.message) ??
        pickText(m.reply);
    }
    if (!text) continue;

    const ts = typeof m.timestamp === "number" ? m.timestamp : undefined;
    const runId = typeof m.runId === "string" ? m.runId : undefined;
    const stableKey = `${ts ?? "na"}:${role}:${text.slice(0, 64)}`;
    // Normalize assistant IDs by runId when present so WS streaming and history
    // hydration collide into a single message.
    const externalMessageId =
      role === "assistant" && runId
        ? `${runId}:assistant`
        : (typeof m.id === "string" && m.id) ||
          (typeof m.messageId === "string" && m.messageId) ||
          `hist_${ts ?? Date.now()}_${role}_${hashString(stableKey).slice(0, 8)}`;

    out.push({
      externalMessageId,
      role,
      fromUser: role === "user",
      content: text,
      state: "completed",
      eventAt: ts,
    });
  }

  // Deterministic order by timestamp where possible.
  return out.sort((a, b) => (a.eventAt ?? 0) - (b.eventAt ?? 0));
}

export type ToolExecTrace = {
  toolCallId: string;
  toolName: string;
  command?: string;
  resultText?: string;
  status?: "completed" | "error";
  timestamp?: number;
  resultTimestamp?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!asRecord(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function extractExecTracesFromHistory(history: unknown): ToolExecTrace[] {
  const messages = pickHistoryMessages(history);
  if (messages.length === 0) return [];

  const byId = new Map<string, ToolExecTrace>();

  for (const m of messages) {
    const role = asString(m.role) ?? "assistant";
    const timestamp = asNumber(m.timestamp);

    // Tool calls are represented as assistant content parts with type:"toolCall".
    if (role === "assistant" && Array.isArray(m.content)) {
      for (const part of m.content) {
        if (!isRecord(part)) continue;
        if (part.type !== "toolCall") continue;
        const toolCallId = asString(part.id);
        const toolName = asString(part.name) ?? "exec";
        const args = asRecord(part.arguments);
        const command = asString(args?.command);
        if (!toolCallId) continue;
        const existing = byId.get(toolCallId) ?? {
          toolCallId,
          toolName,
        };
        byId.set(toolCallId, {
          ...existing,
          toolName,
          command: command ?? existing.command,
          timestamp: timestamp ?? existing.timestamp,
        });
      }
    }

    // Tool results are represented as messages with role:"toolResult".
    if (role === "toolResult") {
      const toolCallId = asString(m.toolCallId);
      const toolName = asString(m.toolName) ?? "exec";
      if (!toolCallId) continue;

      const details = asRecord(m.details);
      const statusRaw = asString(details?.status);
      const status: "completed" | "error" | undefined =
        statusRaw === "error" || statusRaw === "failed"
          ? "error"
          : statusRaw === "completed"
            ? "completed"
            : undefined;

      const resultText =
        asString(details?.aggregated) ??
        pickText(m.content) ??
        pickText(details) ??
        undefined;

      const existing = byId.get(toolCallId) ?? { toolCallId, toolName };
      byId.set(toolCallId, {
        ...existing,
        toolName,
        status: status ?? existing.status,
        resultText: resultText ?? existing.resultText,
        resultTimestamp: timestamp ?? existing.resultTimestamp,
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.timestamp ?? a.resultTimestamp ?? 0;
    const tb = b.timestamp ?? b.resultTimestamp ?? 0;
    return ta - tb;
  });
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
  // Gateway emits both "req/res" frames and "event" frames.
  // For events, the useful fields are usually nested under `payload`.
  const payload = asRecord(raw.payload) ?? null;
  const message = payload ? (asRecord(payload.message) ?? null) : null;

  const sessionKey =
    (typeof raw.sessionKey === "string" && raw.sessionKey) ||
    (typeof raw.session === "string" && raw.session) ||
    (typeof raw.sessionId === "string" && raw.sessionId) ||
    (payload && typeof payload.sessionKey === "string" && payload.sessionKey) ||
    (payload && typeof payload.session === "string" && payload.session) ||
    (payload && typeof payload.sessionId === "string" && payload.sessionId);
  if (!sessionKey) return null;

  const eventType =
    // Prefer the explicit gateway `event` label, otherwise fall back to `type/name`.
    (typeof raw.event === "string" && raw.event) ||
    (typeof raw.type === "string" && raw.type) ||
    (typeof raw.name === "string" && raw.name) ||
    (payload && typeof payload.event === "string" && payload.event) ||
    "unknown";

  const seq =
    (typeof raw.seq === "number" && raw.seq) ||
    (payload && typeof payload.seq === "number" && payload.seq) ||
    undefined;
  const runIdFromPayload =
    payload && typeof payload.runId === "string" ? payload.runId : undefined;
  const eventId =
    (typeof raw.id === "string" && raw.id) ||
    (typeof raw.eventId === "string" && raw.eventId) ||
    (seq !== undefined
      ? `evt_${sessionKey}_${runIdFromPayload ?? "na"}_${seq}`
      : fallbackEventId);

  const runId =
    (typeof raw.runId === "string" && raw.runId) || runIdFromPayload;

  // Support both legacy flat text and the structured OpenClaw chat message format.
  // Examples seen:
  // - event:"chat" payload.message.content=[{type:"text",text:"..."}]
  // - event:"agent" payload.data.text / payload.delta
  const content =
    (typeof raw.delta === "string" && raw.delta) ||
    (typeof raw.content === "string" && raw.content) ||
    (typeof raw.reply === "string" && raw.reply) ||
    (payload && pickText(payload.data) ? pickText(payload.data) : undefined) ||
    (message && pickText(message.content) ? pickText(message.content) : undefined) ||
    (payload && pickText(payload.message) ? pickText(payload.message) : undefined) ||
    undefined;

  const roleRaw =
    (typeof raw.role === "string" && raw.role) ||
    (typeof raw.author === "string" && raw.author) ||
    (payload && typeof payload.stream === "string" ? payload.stream : undefined) ||
    (message && typeof message.role === "string" ? message.role : undefined) ||
    "assistant";
  const role: "user" | "assistant" | "system" | "tool" =
    roleRaw === "user" ||
    roleRaw === "assistant" ||
    roleRaw === "system" ||
    roleRaw === "tool"
      ? roleRaw
      : roleRaw === "toolResult" || roleRaw === "toolCall"
        ? "tool"
        : "assistant";

  const fromUser = role === "user";
  const messageId =
    (typeof raw.messageId === "string" && raw.messageId) ||
    (payload && typeof payload.messageId === "string" ? payload.messageId : undefined) ||
    (runId ? `${runId}:assistant` : `${sessionKey}:${eventId}`);

  const isMessageEvent =
    eventType.includes("chat") ||
    eventType.includes("message") ||
    eventType === "chat" ||
    content !== undefined ||
    runId !== undefined;

  const payloadState = payload ? payload.state : undefined; // "delta" | "final" for chat events
  const status =
    payloadState === "final"
      ? "completed"
      : payloadState === "delta"
        ? "streaming"
        : raw.status;

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
          // Most gateway deltas send the full accumulated text, so we replace content.
          // If a gateway emits true incremental deltas, it will use `raw.delta` at top-level.
          append: typeof raw.delta === "string",
          state: mapStatusToMessageState(status),
          errorMessage: typeof raw.error === "string" ? raw.error : undefined,
        }
      : undefined,
    sessionStatus:
      raw.status === "failed" || raw.status === "error" || status === "failed"
        ? "error"
        : raw.status === "completed" || raw.status === "done" || status === "completed"
          ? "idle"
          : undefined,
    openclawSessionId:
      (typeof raw.sessionId === "string" ? raw.sessionId : undefined) ||
      (payload && typeof payload.sessionId === "string" ? payload.sessionId : undefined),
  };
}

export class OpenClawBrowserGatewayClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<string, PendingRequest>();
  private lastCloseReason: string | null = null;
  private debug = isGatewayDebugEnabled();

  constructor(
    private config: GatewayClientConfig,
    private onEvent: (event: GatewayMessage) => Promise<void>,
  ) {}

  private formatGatewayError(errorValue: unknown): string {
    if (typeof errorValue === "string") return errorValue;
    const errObj = asRecord(errorValue);
    if (!errObj) return String(errorValue);

    const code = typeof errObj.code === "string" ? errObj.code : undefined;
    const message =
      (typeof errObj.message === "string" && errObj.message) ||
      (typeof errObj.error === "string" && errObj.error) ||
      JSON.stringify(errObj);

    return code ? `${code}: ${message}` : message;
  }

  private log(event: string, details?: unknown) {
    if (!this.debug) return;
    if (details !== undefined) {
      console.info("[OpenClawGateway]", event, redactForLog(details));
      return;
    }
    console.info("[OpenClawGateway]", event);
  }

  private buildConnectAttempts(): Array<{
    method: string;
    params: Record<string, unknown>;
  }> {
    const scopes = normalizeScopes(this.config.scopes, this.config.role);
    const scopeCsv = scopes.join(",");
    const scopeSp = scopes.join(" ");

    const base = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.config.clientId,
        version: "0.1.0",
        mode: this.config.clientMode,
        platform: this.config.clientPlatform,
      },
      role: this.config.role,
      locale: "en-US",
    };

    const authBase = {
      token: this.config.authToken,
      password: this.config.password,
    };

    return [
      {
        method: "connect",
        params: {
          ...base,
          scopes,
          auth: authBase,
        },
      },
      {
        method: "connect",
        params: {
          ...base,
          scopes,
          scope: scopeCsv,
          auth: {
            ...authBase,
            scopes,
            scope: scopeCsv,
            role: this.config.role,
          },
        },
      },
      {
        method: "connect",
        params: {
          ...base,
          scopes,
          scope: scopeSp,
          auth: {
            ...authBase,
            scopes,
            scope: scopeSp,
            role: this.config.role,
          },
        },
      },
      {
        method: "gateway.connect",
        params: {
          ...base,
          scopes,
          scope: scopeSp,
          auth: {
            ...authBase,
            scopes,
            scope: scopeSp,
            role: this.config.role,
          },
        },
      },
    ];
  }

  private async openSocket(): Promise<WebSocket> {
    this.log("ws.open.start", { wsUrl: this.config.wsUrl });
    return await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(this.config.wsUrl);
      let settled = false;
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {}
        reject(new Error("Gateway WebSocket open timeout"));
      }, 10_000);

      ws.addEventListener("open", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.lastCloseReason = null;
        this.log("ws.open.ok");
        resolve(ws);
      });

      ws.addEventListener("error", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.log("ws.open.error");
        reject(new Error("Gateway WebSocket error during handshake"));
      });

      ws.addEventListener("close", (event) => {
        const detail = `code=${event.code}${event.reason ? ` reason=${event.reason}` : ""}`;
        this.lastCloseReason = detail;
        this.log("ws.open.closed_before_ready", { detail });
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (timedOut) return;
        reject(new Error(`Gateway WebSocket closed before open (${detail})`));
      });
    });
  }

  private attachSocketListeners(ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      void (async () => {
        try {
          const parsed = JSON.parse(String(event.data)) as GatewayMessage;
          this.log("ws.message", parsed);
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
              pending.reject(
                new Error(this.formatGatewayError(parsed.error)),
              );
            } else {
              pending.resolve(parsed.result ?? parsed);
            }
            return;
          }

          await this.onEvent(parsed);
        } catch (error) {
          this.log("ws.message.parse_error", {
            error: error instanceof Error ? error.message : String(error),
            raw: String(event.data),
          });
          console.warn("Gateway event parse/handler error:", error);
        }
      })();
    });

    ws.addEventListener("close", (event) => {
      this.ws = null;
      const detail = `code=${event.code}${event.reason ? ` reason=${event.reason}` : ""}`;
      this.lastCloseReason = detail;
      this.log("ws.closed", { detail });
      for (const [id, pending] of this.pending.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(
          new Error(`Gateway socket closed (request ${id}, ${detail})`),
        );
      }
      this.pending.clear();
    });
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const attempts = this.buildConnectAttempts();
    let lastError: unknown = null;
    this.log("connect.start", {
      wsUrl: this.config.wsUrl,
      protocol: this.config.protocol,
      attempts: attempts.map((a) => ({ method: a.method, params: a.params })),
    });

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        this.log("connect.attempt.start", { index: i + 1, method: attempt.method });
        const ws = await this.openSocket();
        this.ws = ws;
        this.attachSocketListeners(ws);

        await this.request(attempt.method, attempt.params);
        this.log("connect.attempt.ok", { index: i + 1, method: attempt.method });

        if (this.config.subscribeOnConnect) {
          try {
            await this.request(this.config.subscribeMethod, {});
            this.log("connect.subscribe.ok", {
              method: this.config.subscribeMethod,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            if (!message.includes("unknown method")) throw error;
            this.log("connect.subscribe.unknown_method_ignored", {
              method: this.config.subscribeMethod,
              message,
            });
          }
        }
        this.log("connect.done");
        return;
      } catch (error) {
        lastError = error;
        this.log("connect.attempt.error", {
          index: i + 1,
          method: attempt.method,
          error: error instanceof Error ? error.message : String(error),
        });
        await this.disconnect().catch(() => {});
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    const suffix = this.lastCloseReason ? ` [last-close: ${this.lastCloseReason}]` : "";
    this.log("connect.failed", { message, lastCloseReason: this.lastCloseReason });
    throw new Error(`Gateway connect failed: ${message}${suffix}`);
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
      const detail = this.lastCloseReason ? ` (${this.lastCloseReason})` : "";
      throw new Error(`Gateway socket not connected${detail}`);
    }

    const id = String(this.nextId++);
    const payload =
      this.config.protocol === "jsonrpc"
        ? { jsonrpc: "2.0", id, method, params }
        : { type: "req", id, method, params };
    this.log("request.send", { id, method, payload });

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
