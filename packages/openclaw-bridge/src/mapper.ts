export type GatewayEvent = {
  type?: string;
  event?: string;
  name?: string;
  sessionKey?: string;
  session?: string;
  sessionId?: string;
  runId?: string;
  messageId?: string;
  content?: string;
  delta?: string;
  status?: string;
  role?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

export type IngestInput = {
  sessionKey: string;
  eventId: string;
  eventType: string;
  eventAt?: number;
  payload: Record<string, unknown>;
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
    sequence?: number;
  };
  sessionStatus?: "active" | "idle" | "error" | "closed";
  openclawSessionId?: string;
};

function pickSessionKey(event: GatewayEvent) {
  return (
    event.sessionKey ??
    (typeof event.session === "string" ? event.session : undefined) ??
    (typeof event.sessionId === "string" ? event.sessionId : undefined)
  );
}

function mapStatusToMessageState(
  status: unknown,
): NonNullable<IngestInput["message"]>["state"] {
  if (status === "completed" || status === "done") return "completed";
  if (status === "failed" || status === "error") return "failed";
  if (status === "aborted" || status === "cancelled") return "aborted";
  if (status === "queued") return "queued";
  if (status === "sending") return "sending";
  return "streaming";
}

export function mapGatewayEventToIngestInput(
  raw: GatewayEvent,
  fallbackEventId: string,
): IngestInput | null {
  const eventType =
    typeof raw.type === "string"
      ? raw.type
      : typeof raw.event === "string"
        ? raw.event
        : typeof raw.name === "string"
          ? raw.name
          : "unknown";

  const sessionKey = pickSessionKey(raw);
  if (!sessionKey) return null;

  const eventId =
    typeof raw.id === "string"
      ? raw.id
      : typeof raw.eventId === "string"
        ? raw.eventId
        : fallbackEventId;

  const runId = typeof raw.runId === "string" ? raw.runId : undefined;
  const messageId =
    typeof raw.messageId === "string"
      ? raw.messageId
      : runId
        ? `${runId}:assistant`
        : `${sessionKey}:${eventId}`;

  const content =
    typeof raw.delta === "string"
      ? raw.delta
      : typeof raw.content === "string"
        ? raw.content
        : typeof raw.reply === "string"
          ? raw.reply
          : undefined;

  const roleRaw =
    typeof raw.role === "string"
      ? raw.role
      : typeof raw.author === "string"
        ? raw.author
        : "assistant";
  const normalizedRole =
    roleRaw === "user" ||
    roleRaw === "assistant" ||
    roleRaw === "system" ||
    roleRaw === "tool"
      ? roleRaw
      : "assistant";

  const fromUser = normalizedRole === "user";

  const terminalStatus =
    raw.status === "failed" || raw.status === "error"
      ? "error"
      : raw.status === "completed" || raw.status === "done"
        ? "idle"
        : undefined;

  const isMessageEvent =
    eventType.includes("chat") ||
    eventType.includes("message") ||
    content !== undefined ||
    runId !== undefined;

  return {
    sessionKey,
    eventId,
    eventType,
    payload: raw as Record<string, unknown>,
    message: isMessageEvent
      ? {
          externalMessageId: messageId,
          externalRunId: runId,
          role: normalizedRole,
          fromUser,
          content,
          append: typeof raw.delta === "string",
          state: mapStatusToMessageState(raw.status),
          errorMessage: typeof raw.error === "string" ? raw.error : undefined,
        }
      : undefined,
    sessionStatus: terminalStatus,
    openclawSessionId:
      typeof raw.sessionId === "string" ? raw.sessionId : undefined,
  };
}
