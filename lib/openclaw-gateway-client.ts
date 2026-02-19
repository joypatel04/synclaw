import {
  type DeviceProofVariant,
  buildDeviceProofForConnectV3,
  OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V1,
  OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V2,
  readStoredDeviceIdentityV2,
} from "@/lib/openclaw/device-auth-v3";

export type GatewayProtocol = "req" | "jsonrpc";
type GatewayWireProtocol = GatewayProtocol | "raw";

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

export type OpenClawConnectionState =
  | "PAIRING_REQUIRED"
  | "PAIRING_PENDING"
  | "SCOPES_INSUFFICIENT"
  | "CONNECTED"
  | "INVALID_CONFIG";

export type OpenClawReasonCode =
  | "DEVICE_IDENTITY_MISMATCH"
  | "DEVICE_SIGNATURE_INVALID"
  | "MISSING_SCOPE"
  | "PAIRING_APPROVAL_REQUIRED"
  | "INVALID_CONNECT_PARAMS"
  | "UNAUTHORIZED"
  | "INVALID_HANDSHAKE"
  | "UNKNOWN_METHOD"
  | "UNKNOWN";

export type OpenClawConnectionStatus = {
  state: OpenClawConnectionState;
  phase:
    | "ws_open"
    | "challenge"
    | "sign"
    | "connect"
    | "verify_read"
    | "verify_admin";
  result: "ok" | "fail";
  reasonCode?: OpenClawReasonCode;
  verifyMethod?: string;
  message: string;
  missingScope?: string;
  deviceId?: string;
  lastCloseReason?: string | null;
};

export function isOpenClawLegacyClientEnabled(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.NEXT_PUBLIC_OPENCLAW_LEGACY_CLIENT === "1";
}

function buildClientModeAttempts(clientMode: string, role: string): string[] {
  const out: string[] = [];
  const push = (v: string | undefined | null) => {
    const value = (v ?? "").trim();
    if (!value) return;
    if (!out.includes(value)) out.push(value);
  };

  // Keep user-configured mode first.
  push(clientMode);

  const normalizedRole = (role || "").trim().toLowerCase();
  if (normalizedRole === "operator") {
    // Gateways differ by version; try common operator-compatible modes.
    push("webchat");
    push("operator");
  }

  if (out.length === 0) out.push("webchat");
  return out;
}

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

type DeviceIdentity = {
  alg: "Ed25519" | "ECDSA_P256";
  deviceId: string;
  publicKeyB64u: string;
  privateKey: CryptoKey;
};

type DeviceProfileVariant =
  | "legacy_web_id_b64u"
  | "sha64_b64u"
  | "sha64_b64"
  | "sha32_b64u";

type ConnectChallenge = {
  nonce: string;
  ts?: number;
};

export const OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY =
  OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V2;
export const OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_LEGACY =
  OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V1;
export const OPENCLAW_DEVICE_TOKEN_STORAGE_PREFIX =
  "sutraha:openclaw:deviceToken:";
export const OPENCLAW_DEVICE_AUTH_ENABLED_KEY =
  "sutraha:openclaw:deviceAuthEnabled";

export function openClawDeviceTokenStorageKey(wsUrl: string, role: string) {
  return `${OPENCLAW_DEVICE_TOKEN_STORAGE_PREFIX}${wsUrl}|${role}`;
}

export function clearOpenClawLocalAuthState(wsUrl?: string, role?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY);
    window.localStorage.removeItem(OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_LEGACY);
    if (wsUrl && role) {
      window.localStorage.removeItem(openClawDeviceTokenStorageKey(wsUrl, role));
    } else {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(OPENCLAW_DEVICE_TOKEN_STORAGE_PREFIX)) {
          keys.push(key);
        }
      }
      for (const key of keys) window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

export function isOpenClawDeviceAuthEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(OPENCLAW_DEVICE_AUTH_ENABLED_KEY);
    // Default ON for modern OpenClaw gateways unless explicitly disabled.
    if (raw === null) return true;
    return raw === "1" || raw === "true";
  } catch {
    return true;
  }
}

export function setOpenClawDeviceAuthEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      OPENCLAW_DEVICE_AUTH_ENABLED_KEY,
      enabled ? "1" : "0",
    );
  } catch {
    // ignore storage errors
  }
}

function toUtf8Bytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function fromBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  const arr = new Uint8Array(digest);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseStoredJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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

function parseMissingScope(message: string): string | undefined {
  const match = message.match(/missing scope:\s*([a-z0-9._-]+)/i);
  return match?.[1];
}

function classifyConnectionFailure(
  phase: OpenClawConnectionStatus["phase"],
  message: string,
  lastCloseReason: string | null,
  deviceId?: string,
  verifyMethod?: string,
): OpenClawConnectionStatus {
  const lower = message.toLowerCase();
  const missingScope = parseMissingScope(message);
  if (missingScope) {
    return {
      state: "SCOPES_INSUFFICIENT",
      phase,
      result: "fail",
      reasonCode: "MISSING_SCOPE",
      message,
      missingScope,
      deviceId,
      lastCloseReason,
      verifyMethod,
    };
  }
  if (lower.includes("device identity mismatch")) {
    return {
      state: "PAIRING_REQUIRED",
      phase,
      result: "fail",
      reasonCode: "DEVICE_IDENTITY_MISMATCH",
      message,
      deviceId,
      lastCloseReason,
      verifyMethod,
    };
  }
  if (lower.includes("device signature invalid")) {
    return {
      state: "PAIRING_REQUIRED",
      phase,
      result: "fail",
      reasonCode: "DEVICE_SIGNATURE_INVALID",
      message,
      deviceId,
      lastCloseReason,
      verifyMethod,
    };
  }
  if (lower.includes("pair") && (lower.includes("pending") || lower.includes("approve"))) {
    return {
      state: "PAIRING_PENDING",
      phase,
      result: "fail",
      reasonCode: "PAIRING_APPROVAL_REQUIRED",
      message,
      deviceId,
      lastCloseReason,
      verifyMethod,
    };
  }
  if (lower.includes("invalid connect params")) {
    return {
      state: "INVALID_CONFIG",
      phase,
      result: "fail",
      reasonCode: "INVALID_CONNECT_PARAMS",
      message,
      deviceId,
      lastCloseReason,
      verifyMethod,
    };
  }
  if (lower.includes("unauthorized") || lower.includes("token mismatch")) {
    return {
      state: "INVALID_CONFIG",
      phase,
      result: "fail",
      reasonCode: "UNAUTHORIZED",
      message,
      deviceId,
      lastCloseReason,
      verifyMethod,
    };
  }
  if (lower.includes("invalid handshake")) {
    return {
      state: "INVALID_CONFIG",
      phase,
      result: "fail",
      reasonCode: "INVALID_HANDSHAKE",
      message,
      deviceId,
      lastCloseReason,
      verifyMethod,
    };
  }
  if (lower.includes("unknown method")) {
    return {
      state: "INVALID_CONFIG",
      phase,
      result: "fail",
      reasonCode: "UNKNOWN_METHOD",
      message,
      deviceId,
      lastCloseReason,
      verifyMethod,
    };
  }
  return {
    state: "INVALID_CONFIG",
    phase,
    result: "fail",
    reasonCode: "UNKNOWN",
    message,
    deviceId,
    lastCloseReason,
    verifyMethod,
  };
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
  private latestChallenge: ConnectChallenge | null = null;
  private challengeWaiters: Array<(value: ConnectChallenge | null) => void> = [];
  private lastStatus: OpenClawConnectionStatus | null = null;
  private lastDeviceId: string | undefined;
  private reconnectCount = 0;
  private lastWsSeq: number | null = null;
  private lastStreamEventAt: number | null = null;
  private lastHistorySyncAt: number | null = null;
  private lastHistoryError: string | null = null;
  private optionalProbeMethod: string | null = null;
  private optionalProbeError: string | null = null;

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

  getConnectionStatus(): OpenClawConnectionStatus | null {
    return this.lastStatus;
  }

  getDiagnostics() {
    const localIdentity = readStoredDeviceIdentityV2();
    const streamActive =
      this.lastStreamEventAt !== null &&
      Date.now() - this.lastStreamEventAt < 15_000;
    return {
      status: this.lastStatus,
      lastCloseReason: this.lastCloseReason,
      wsUrl: this.config.wsUrl,
      role: this.config.role,
      clientMode: this.config.clientMode,
      clientId: this.config.clientId,
      deviceId: this.lastDeviceId,
      localIdentity: localIdentity ? { deviceId: localIdentity.deviceId } : null,
      reconnectCount: this.reconnectCount,
      lastWsSeq: this.lastWsSeq,
      connectOk: this.lastStatus?.state === "CONNECTED",
      streamActive,
      historySyncOk: this.lastHistoryError == null,
      lastHistorySyncAt: this.lastHistorySyncAt,
      lastHistoryError: this.lastHistoryError,
      verifyReadMethod: this.optionalProbeMethod,
      verifyReadError: this.optionalProbeError,
      legacyMode: isOpenClawLegacyClientEnabled(),
    };
  }

  private tokenStorageKey(): string {
    return openClawDeviceTokenStorageKey(this.config.wsUrl, this.config.role);
  }

  private getStoredDeviceToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(this.tokenStorageKey());
    } catch {
      return null;
    }
  }

  private saveStoredDeviceToken(token: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.tokenStorageKey(), token);
      this.log("deviceToken.saved");
    } catch {
      // ignore storage failures
    }
  }

  private async loadOrCreateDeviceIdentity(): Promise<DeviceIdentity | null> {
    if (typeof window === "undefined" || !window.isSecureContext) return null;
    if (!crypto?.subtle) return null;

    const stored = parseStoredJson<{
      alg: "Ed25519" | "ECDSA_P256";
      deviceId: string;
      publicKeyB64u: string;
      privateJwk: JsonWebKey;
    }>(
      window.localStorage.getItem(OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY),
    );

    const importStored = async () => {
      if (!stored) return null;
      try {
        if (stored.alg === "Ed25519") {
          const privateKey = await crypto.subtle.importKey(
            "jwk",
            stored.privateJwk,
            { name: "Ed25519" },
            false,
            ["sign"],
          );
          return {
            alg: "Ed25519" as const,
            deviceId: stored.deviceId,
            publicKeyB64u: stored.publicKeyB64u,
            privateKey,
          };
        }
        const privateKey = await crypto.subtle.importKey(
          "jwk",
          stored.privateJwk,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"],
        );
        return {
          alg: "ECDSA_P256" as const,
          deviceId: stored.deviceId,
          publicKeyB64u: stored.publicKeyB64u,
          privateKey,
        };
      } catch {
        return null;
      }
    };

    const existing = await importStored();
    if (existing) return existing;

    try {
      const kp = await crypto.subtle.generateKey(
        { name: "Ed25519" },
        true,
        ["sign", "verify"],
      );
      const privateJwk = (await crypto.subtle.exportKey(
        "jwk",
        kp.privateKey,
      )) as JsonWebKey;
      const spki = new Uint8Array(
        await crypto.subtle.exportKey("spki", kp.publicKey),
      );
      const publicKeyB64u = toBase64Url(spki);
      const fingerprint = (await sha256Hex(spki)).slice(0, 32);
      const identityDoc = {
        alg: "Ed25519" as const,
        deviceId: `web-${fingerprint}`,
        publicKeyB64u,
        privateJwk,
      };
      window.localStorage.setItem(
        OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY,
        JSON.stringify(identityDoc),
      );
      return {
        alg: identityDoc.alg,
        deviceId: identityDoc.deviceId,
        publicKeyB64u: identityDoc.publicKeyB64u,
        privateKey: kp.privateKey,
      };
    } catch {
      // Fall back to ECDSA if Ed25519 isn't available.
    }

    try {
      const kp = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const privateJwk = (await crypto.subtle.exportKey(
        "jwk",
        kp.privateKey,
      )) as JsonWebKey;
      const spki = new Uint8Array(
        await crypto.subtle.exportKey("spki", kp.publicKey),
      );
      const publicKeyB64u = toBase64Url(spki);
      const fingerprint = (await sha256Hex(spki)).slice(0, 32);
      const identityDoc = {
        alg: "ECDSA_P256" as const,
        deviceId: `web-${fingerprint}`,
        publicKeyB64u,
        privateJwk,
      };
      window.localStorage.setItem(
        OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY,
        JSON.stringify(identityDoc),
      );
      return {
        alg: identityDoc.alg,
        deviceId: identityDoc.deviceId,
        publicKeyB64u: identityDoc.publicKeyB64u,
        privateKey: kp.privateKey,
      };
    } catch {
      return null;
    }
  }

  private challengeMessage(
    challenge: ConnectChallenge,
    signedAt: number,
    variant: "nonce" | "nonce_signedAt" | "json",
  ): Uint8Array {
    if (variant === "nonce") {
      return toUtf8Bytes(challenge.nonce);
    }
    if (variant === "nonce_signedAt") {
      return toUtf8Bytes(`${challenge.nonce}:${signedAt}`);
    }
    return toUtf8Bytes(
      JSON.stringify({
        nonce: challenge.nonce,
        signedAt,
        challengeTs: challenge.ts ?? null,
      }),
    );
  }

  private async buildSignedDevice(
    challenge: ConnectChallenge,
    variant: "nonce" | "nonce_signedAt" | "json",
    profile: DeviceProfileVariant,
  ): Promise<Record<string, unknown> | null> {
    const identity = await this.loadOrCreateDeviceIdentity();
    if (!identity) return null;
    const signedAt = Date.now();
    const message = this.challengeMessage(challenge, signedAt, variant);
    const signatureBuf =
      identity.alg === "Ed25519"
        ? await crypto.subtle.sign(
            { name: "Ed25519" },
            identity.privateKey,
            toArrayBuffer(message),
          )
        : await crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            identity.privateKey,
            toArrayBuffer(message),
          );
    const signature = toBase64Url(new Uint8Array(signatureBuf));
    const spkiBytes = fromBase64Url(identity.publicKeyB64u);
    const sha64 = await sha256Hex(spkiBytes);
    const publicKey =
      profile === "sha64_b64" ? toBase64(spkiBytes) : identity.publicKeyB64u;
    const deviceId =
      profile === "sha64_b64u" || profile === "sha64_b64"
        ? sha64
        : profile === "sha32_b64u"
          ? sha64.slice(0, 32)
          : identity.deviceId;
    return {
      id: deviceId,
      publicKey,
      signedAt,
      nonce: challenge.nonce,
      signature,
    };
  }

  private waitForChallenge(timeoutMs = 300): Promise<ConnectChallenge | null> {
    if (this.latestChallenge) return Promise.resolve(this.latestChallenge);
    return new Promise((resolve) => {
      const resolver = (value: ConnectChallenge | null) => {
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        this.challengeWaiters = this.challengeWaiters.filter((r) => r !== resolver);
        resolve(null);
      }, timeoutMs);
      this.challengeWaiters.push(resolver);
    });
  }

  private isIgnorableSubscribeError(message: string): boolean {
    const m = message.toLowerCase();
    if (m.includes("unknown method")) return true;
    // Newer gateways may gate live subscribe behind elevated scope.
    // We can continue without subscription and rely on history polling.
    if (m.includes("missing scope") && m.includes("operator.admin")) return true;
    return false;
  }

  private buildConnectAttempts(): Array<{
    method: string;
    params: Record<string, unknown>;
    wireProtocol: GatewayWireProtocol;
    withDeviceChallenge: boolean;
    deviceVariant: "nonce" | "nonce_signedAt" | "json";
    deviceProfile: DeviceProfileVariant;
    clientMode: string;
  }> {
    const scopes = normalizeScopes(this.config.scopes, this.config.role);
    const clientModes = buildClientModeAttempts(
      this.config.clientMode,
      this.config.role,
    );
    const deviceAuthEnabled = isOpenClawDeviceAuthEnabled();
    const storedDeviceToken = this.getStoredDeviceToken();
    const preferredToken =
      deviceAuthEnabled && storedDeviceToken
        ? storedDeviceToken
        : this.config.authToken;

    const authBase = {
      token: preferredToken,
      password: this.config.password,
    };
    const authFallback = {
      token: this.config.authToken,
      password: this.config.password,
    };

    const challengeModes: Array<{
      withDeviceChallenge: boolean;
      deviceVariant: "nonce" | "nonce_signedAt" | "json";
      deviceProfile: DeviceProfileVariant;
    }> = deviceAuthEnabled
      ? [
          {
            withDeviceChallenge: true,
            deviceVariant: "nonce",
            deviceProfile: "legacy_web_id_b64u",
          },
          {
            withDeviceChallenge: true,
            deviceVariant: "nonce_signedAt",
            deviceProfile: "legacy_web_id_b64u",
          },
          {
            withDeviceChallenge: true,
            deviceVariant: "json",
            deviceProfile: "legacy_web_id_b64u",
          },
          {
            withDeviceChallenge: true,
            deviceVariant: "nonce",
            deviceProfile: "sha64_b64u",
          },
          {
            withDeviceChallenge: true,
            deviceVariant: "nonce",
            deviceProfile: "sha64_b64",
          },
          {
            withDeviceChallenge: true,
            deviceVariant: "nonce",
            deviceProfile: "sha32_b64u",
          },
          {
            withDeviceChallenge: false,
            deviceVariant: "nonce",
            deviceProfile: "legacy_web_id_b64u",
          },
        ]
      : [
          {
            withDeviceChallenge: false,
            deviceVariant: "nonce",
            deviceProfile: "legacy_web_id_b64u",
          },
        ];

    const mk = (
      method: string,
      wireProtocol: GatewayWireProtocol,
      params: Record<string, unknown>,
      withDeviceChallenge: boolean,
      deviceVariant: "nonce" | "nonce_signedAt" | "json",
      deviceProfile: DeviceProfileVariant,
      clientMode: string,
    ) => ({
      method,
      wireProtocol,
      params,
      withDeviceChallenge,
      deviceVariant,
      deviceProfile,
      clientMode,
    });

    const out: Array<{
      method: string;
      params: Record<string, unknown>;
      wireProtocol: GatewayWireProtocol;
      withDeviceChallenge: boolean;
      deviceVariant: "nonce" | "nonce_signedAt" | "json";
      deviceProfile: DeviceProfileVariant;
      clientMode: string;
    }> = [];

    for (const clientMode of clientModes) {
      const base = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: this.config.clientId,
          version: "0.1.0",
          mode: clientMode,
          platform: this.config.clientPlatform,
        },
        role: this.config.role,
        locale: "en-US",
      };

      for (const mode of challengeModes) {
        out.push(
          mk(
            "connect",
            "req",
            { ...base, scopes, auth: authBase },
            mode.withDeviceChallenge,
            mode.deviceVariant,
            mode.deviceProfile,
            clientMode,
          ),
        );
      }
    }

    // If we have a stored device token, also try raw configured token in fallback.
    if (
      storedDeviceToken &&
      this.config.authToken &&
      this.config.authToken !== storedDeviceToken
    ) {
      out.push(
        mk(
          "connect",
          "req",
          {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: this.config.clientId,
              version: "0.1.0",
              mode: clientModes[0] ?? this.config.clientMode,
              platform: this.config.clientPlatform,
            },
            role: this.config.role,
            locale: "en-US",
            scopes,
            auth: authFallback,
          },
          false,
          "nonce",
          "legacy_web_id_b64u",
          clientModes[0] ?? this.config.clientMode,
        ),
      );
    }

    return out;
  }

  private async openSocket(): Promise<WebSocket> {
    this.log("ws.open.start", { wsUrl: this.config.wsUrl });
    this.reconnectCount += 1;
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
          const payloadObj = asRecord(parsed.payload);
          const parsedSeq =
            (typeof parsed.seq === "number" ? parsed.seq : undefined) ||
            (payloadObj && typeof payloadObj.seq === "number"
              ? payloadObj.seq
              : undefined);
          if (typeof parsedSeq === "number") this.lastWsSeq = parsedSeq;
          if (typeof parsed.event === "string") {
            const eventName = parsed.event.toLowerCase();
            if (
              eventName.includes("chat") ||
              eventName.includes("message") ||
              (payloadObj && typeof payloadObj.runId === "string")
            ) {
              this.lastStreamEventAt = Date.now();
            }
          }
          this.log("ws.message", parsed);
          if (parsed.type === "event" && parsed.event === "connect.challenge") {
            const payload = asRecord(parsed.payload);
            const nonce =
              (payload && typeof payload.nonce === "string" && payload.nonce) || "";
            const ts =
              payload && typeof payload.ts === "number" ? payload.ts : undefined;
            if (nonce) {
              const challenge = { nonce, ts };
              this.latestChallenge = challenge;
              for (const waiter of this.challengeWaiters) waiter(challenge);
              this.challengeWaiters = [];
              this.log("connect.challenge.received", challenge);
            }
          }
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
      this.latestChallenge = null;
      for (const waiter of this.challengeWaiters) waiter(null);
      this.challengeWaiters = [];
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
    if (isOpenClawLegacyClientEnabled()) {
      return this.connectLegacy();
    }
    return this.connectStrict();
  }

  private async connectStrict(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.lastStatus = null;
    this.lastDeviceId = undefined;
    this.optionalProbeMethod = null;
    this.optionalProbeError = null;
    this.log("connect.start", {
      wsUrl: this.config.wsUrl,
      protocol: "req",
      legacyMode: false,
    });
    let phase: OpenClawConnectionStatus["phase"] = "ws_open";
    try {
      const variant: DeviceProofVariant = "v2_raw_token";
      this.log("phase", { phase: "ws_open", result: "ok", variant });
      const ws = await this.openSocket();
      this.ws = ws;
      this.attachSocketListeners(ws);

      phase = "challenge";
      const challenge = await this.waitForChallenge(3_000);
      if (!challenge?.nonce) {
        throw new Error("invalid handshake: missing connect.challenge");
      }
      this.log("phase", {
        phase: "challenge",
        result: "ok",
        nonce: challenge.nonce,
        variant,
      });

      phase = "sign";
      this.log("phase", { phase: "sign", result: "ok", variant });
      const normalizedScopes = normalizeScopes(this.config.scopes, this.config.role);
      const scopes = [...normalizedScopes].sort((a, b) => a.localeCompare(b));
      const clientMode = this.config.clientMode || "webchat";
      const clientId =
        clientMode === "webchat" && (!this.config.clientId || this.config.clientId === "cli")
          ? "openclaw-control-ui"
          : this.config.clientId;
      const clientVersion =
        clientId === "openclaw-control-ui" ? "dev" : "0.1.0";
      const clientPlatform =
        this.config.clientPlatform === "web" && typeof navigator !== "undefined"
          ? navigator.platform || "web"
          : this.config.clientPlatform;

      const proof = await buildDeviceProofForConnectV3({
        challengeNonce: challenge.nonce,
        clientId,
        clientMode,
        role: this.config.role,
        scopes,
        token: this.config.authToken ?? null,
        variant,
      });
      if (!proof) {
        throw new Error("device auth unavailable: secure context + WebCrypto required");
      }
      this.lastDeviceId = proof.device.id;
      this.log("connect.device.attached", {
        deviceId: proof.device.id,
        variant: proof.variant,
      });

      const connectParams = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: clientId,
          version: clientVersion,
          mode: clientMode,
          platform: clientPlatform,
        },
        role: this.config.role,
        locale: "en-US",
        scopes,
        caps: [],
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        auth: {
          token: this.config.authToken,
          password: this.config.password,
        },
        device: proof.device,
      };

      phase = "connect";
      const connectResult = await this.requestWithWireProtocol(
        "connect",
        connectParams,
        "req",
      );
      this.log("connect.variant.ok", { variant });
      const resultObj = asRecord(connectResult);
      const resultPayload = resultObj ? asRecord(resultObj.payload) : null;
      const authObj = resultPayload ? asRecord(resultPayload.auth) : null;
      const deviceToken =
        authObj && typeof authObj.deviceToken === "string"
          ? authObj.deviceToken
          : null;
      if (deviceToken) this.saveStoredDeviceToken(deviceToken);
      this.log("phase", { phase: "connect", result: "ok" });

      // Control-UI parity: connect success is readiness.
      this.lastStatus = {
        state: "CONNECTED",
        phase: "connect",
        result: "ok",
        message: "Connected. Live events + history hydration active.",
        deviceId: this.lastDeviceId,
        lastCloseReason: this.lastCloseReason,
        verifyMethod: this.optionalProbeMethod ?? undefined,
      };

      // Optional, non-blocking readiness probe for diagnostics only.
      phase = "verify_read";
      this.optionalProbeMethod = "health";
      try {
        await this.request("health", {});
        this.optionalProbeError = null;
        this.log("phase", {
          phase: "verify_read",
          result: "ok",
          method: this.optionalProbeMethod,
        });
      } catch (probeError) {
        const probeMessage =
          probeError instanceof Error ? probeError.message : String(probeError);
        this.optionalProbeError = probeMessage;
        this.log("phase", {
          phase: "verify_read",
          result: "fail",
          method: this.optionalProbeMethod,
          reasonCode: probeMessage.toLowerCase().includes("unknown method")
            ? "UNKNOWN_METHOD"
            : "UNKNOWN",
          message: probeMessage,
        });
      }

      // Optional subscription warm-up for compatibility diagnostics only.
      phase = "verify_admin";
      if (this.config.subscribeOnConnect) {
        const adminMethod = this.config.subscribeMethod || "chat.subscribe";
        try {
          await this.request(adminMethod, {});
          this.log("phase", {
            phase: "verify_admin",
            result: "ok",
            method: adminMethod,
          });
        } catch (subscribeError) {
          const subscribeMessage =
            subscribeError instanceof Error
              ? subscribeError.message
              : String(subscribeError);
          this.log("phase", {
            phase: "verify_admin",
            result: "fail",
            method: adminMethod,
            reasonCode: subscribeMessage.toLowerCase().includes("unknown method")
              ? "UNKNOWN_METHOD"
              : "UNKNOWN",
            message: subscribeMessage,
          });
        }
      }
      if (this.lastStatus) {
        this.lastStatus.verifyMethod = this.optionalProbeMethod ?? undefined;
      }
      this.log("connect.done", this.lastStatus);
      return;
    } catch (error) {
      const variant: DeviceProofVariant = "v2_raw_token";
      const msg = error instanceof Error ? error.message : String(error);
      this.log("connect.variant.fail", { variant, error: msg });
      const message =
        error instanceof Error ? error.message : String(error);
      const status = classifyConnectionFailure(
        phase,
        message,
        this.lastCloseReason,
        this.lastDeviceId,
        this.optionalProbeMethod ?? undefined,
      );
      this.lastStatus = status;
      this.log("phase", {
        phase: status.phase,
        result: "fail",
        reasonCode: status.reasonCode,
        message: status.message,
      });
      await this.disconnect().catch(() => {});
      const suffix = this.lastCloseReason ? ` [last-close: ${this.lastCloseReason}]` : "";
      throw new Error(`Gateway connect failed: ${message}${suffix}`);
    }
  }

  private async connectLegacy(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const attempts = this.buildConnectAttempts();
    let lastError: unknown = null;
    this.log("connect.start", {
      wsUrl: this.config.wsUrl,
      protocol: this.config.protocol,
      attempts: attempts.map((a) => ({
        method: a.method,
        wireProtocol: a.wireProtocol,
        clientMode: a.clientMode,
        deviceProfile: a.deviceProfile,
        params: a.params,
      })),
    });

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        this.log("connect.attempt.start", {
          index: i + 1,
          method: attempt.method,
          wireProtocol: attempt.wireProtocol,
          withDeviceChallenge: attempt.withDeviceChallenge,
          deviceVariant: attempt.deviceVariant,
          deviceProfile: attempt.deviceProfile,
          clientMode: attempt.clientMode,
        });
        const ws = await this.openSocket();
        this.ws = ws;
        this.attachSocketListeners(ws);

        const challenge = attempt.withDeviceChallenge
          ? await this.waitForChallenge(450)
          : null;
        const params: Record<string, unknown> = { ...attempt.params };
        if (attempt.withDeviceChallenge && challenge) {
          const device = await this.buildSignedDevice(
            challenge,
            attempt.deviceVariant,
            attempt.deviceProfile,
          );
          if (device) {
            params.device = device;
            this.log("connect.device.attached", {
              index: i + 1,
              deviceId: (device as any).id,
              deviceVariant: attempt.deviceVariant,
              deviceProfile: attempt.deviceProfile,
            });
          }
        }

        const connectResult = await this.requestWithWireProtocol(
          attempt.method,
          params,
          attempt.wireProtocol,
        );
        const resultObj = asRecord(connectResult);
        const resultPayload = resultObj ? asRecord(resultObj.payload) : null;
        const authObj = resultPayload ? asRecord(resultPayload.auth) : null;
        const deviceToken =
          authObj && typeof authObj.deviceToken === "string"
            ? authObj.deviceToken
            : null;
        if (deviceToken && deviceToken.length > 0) {
          this.saveStoredDeviceToken(deviceToken);
        }
        this.log("connect.attempt.ok", {
          index: i + 1,
          method: attempt.method,
          wireProtocol: attempt.wireProtocol,
          clientMode: attempt.clientMode,
          deviceProfile: attempt.deviceProfile,
        });

        if (this.config.subscribeOnConnect) {
          try {
            await this.request(this.config.subscribeMethod, {});
            this.log("connect.subscribe.ok", {
              method: this.config.subscribeMethod,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            if (!this.isIgnorableSubscribeError(message)) throw error;
            this.log("connect.subscribe.ignored", {
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
          wireProtocol: attempt.wireProtocol,
          clientMode: attempt.clientMode,
          deviceProfile: attempt.deviceProfile,
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
    return await this.requestWithWireProtocol(
      method,
      params,
      this.config.protocol,
    );
  }

  async requestWithWireProtocol(
    method: string,
    params: Record<string, unknown>,
    wireProtocol: GatewayWireProtocol,
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const detail = this.lastCloseReason ? ` (${this.lastCloseReason})` : "";
      throw new Error(`Gateway socket not connected${detail}`);
    }

    const id = String(this.nextId++);
    const payload =
      wireProtocol === "jsonrpc"
        ? { jsonrpc: "2.0", id, method, params }
        : wireProtocol === "req"
          ? { type: "req", id, method, params }
          : { id, method, params };
    this.log("request.send", { id, method, wireProtocol, payload });

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
    try {
      const result = await this.request("chat.history", {
        sessionKey: params.sessionKey,
        limit: params.limit ?? 20,
      });
      this.lastHistorySyncAt = Date.now();
      this.lastHistoryError = null;
      this.log("phase", { phase: "history_sync", result: "ok" });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastHistoryError = message;
      this.log("phase", {
        phase: "history_sync",
        result: "fail",
        reasonCode: message.toLowerCase().includes("unknown method")
          ? "UNKNOWN_METHOD"
          : "UNKNOWN",
        message,
      });
      throw error;
    }
  }
}
