"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronDown, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  mapGatewayEventForIngest,
  OpenClawBrowserGatewayClient,
  extractDisplayMessagesFromHistory,
  extractExecTracesFromHistory,
  pickLatestAssistantFromHistory,
  pickRunId,
  pickText,
} from "@/lib/openclaw-gateway-client";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";

interface ChatInterfaceProps {
  agent: Pick<Doc<"agents">, "name" | "emoji" | "role" | "status" | "sessionKey">;
}
type ChatMessageRow = Doc<"chatMessages"> & {
  externalMessageId?: string;
  externalRunId?: string;
  state?:
    | "queued"
    | "sending"
    | "streaming"
    | "completed"
    | "failed"
    | "aborted";
};

export function ChatInterface({ agent }: ChatInterfaceProps) {
  const { workspaceId, canEdit, membershipId } = useWorkspace();
  const sessionId = `chat:${agent.sessionKey}`;
  const messages = (useQuery(api.chatMessages.listBySession, {
    workspaceId,
    sessionId,
  }) ?? []) as ChatMessageRow[];
  const members =
    useQuery(api.workspaces.getMembers, { workspaceId }) ?? [];
  const me = useMemo(
    () => members.find((m) => m._id === membershipId),
    [members, membershipId],
  );
  const eventsForSession =
    useQuery(api.chatEvents.listBySessionKey, {
      workspaceId,
      sessionKey: agent.sessionKey,
      limit: 200,
    }) ?? [];
  const legacySendMessage = useMutation(api.chatMessages.send);
  const upsertGatewayEvent = useMutation(api.chatIngest.upsertGatewayEvent);
  const viewportRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const gatewayRef = useRef<OpenClawBrowserGatewayClient | null>(null);
  const connectRef = useRef<Promise<void> | null>(null);

  // Direct WS is now mandatory for chat.
  const useDirectWs = true;
  const includeCron =
    process.env.NEXT_PUBLIC_OPENCLAW_INCLUDE_CRON === "true";
  const historyPollMs = Number(
    process.env.NEXT_PUBLIC_OPENCLAW_HISTORY_POLL_MS ?? "0",
  );

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Auto-scroll only when the user is already at the bottom.
  useEffect(() => {
    if (messages.length === 0) return;
    if (atBottomRef.current) scrollToBottom("auto");
  }, [messages.length]);

  // Track whether the user has scrolled up; show a jump-to-bottom button.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const thresholdPx = 120;
    const onScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom <= thresholdPx;
      atBottomRef.current = atBottom;
      setShowScrollDown(!atBottom);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(
    () => () => {
      void gatewayRef.current?.disconnect();
      gatewayRef.current = null;
      connectRef.current = null;
    },
    [agent.sessionKey],
  );

  const makeClientMessageId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const ensureDirectGatewayConnected = async () => {
    if (!gatewayRef.current) {
      const scopes = (
        process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_SCOPES ??
        "operator.read,operator.write"
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      gatewayRef.current = new OpenClawBrowserGatewayClient(
        {
          wsUrl: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL ?? "",
          protocol:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_PROTOCOL === "jsonrpc"
              ? "jsonrpc"
              : "req",
          authToken: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_AUTH_TOKEN,
          password: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_PASSWORD,
          clientId: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_ID ?? "cli",
          clientMode:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_MODE ?? "webchat",
          clientPlatform:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_PLATFORM ?? "web",
          role: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_ROLE ?? "operator",
          scopes,
          subscribeOnConnect:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CHAT_SUBSCRIBE === "true",
          subscribeMethod:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_SUBSCRIBE_METHOD ??
            "chat.subscribe",
        },
        async (event) => {
          const mapped = mapGatewayEventForIngest(event, makeClientMessageId());
          if (!mapped) return;
          const isPrimary = mapped.sessionKey === agent.sessionKey;
          const isCron =
            includeCron &&
            mapped.sessionKey.startsWith(`${agent.sessionKey}:cron:`);
          if (!isPrimary && !isCron) return;

          // Optional: mirror cron/heartbeat runs into the primary chat so they show
          // up in Sutraha HQ without creating a separate "cron session" thread.
          const sessionKey = isCron ? agent.sessionKey : mapped.sessionKey;
          const eventId = isCron
            ? `cron:${mapped.sessionKey}:${mapped.eventId}`
            : mapped.eventId;
          await upsertGatewayEvent({
            workspaceId,
            sessionKey,
            eventId,
            eventType: mapped.eventType,
            eventAt: mapped.eventAt,
            payload: mapped.payload,
            message: mapped.message,
            sessionStatus: mapped.sessionStatus,
            openclawSessionId: mapped.openclawSessionId,
          });
        },
      );
    }

    if (!connectRef.current) {
      connectRef.current = gatewayRef.current.connect().catch((error) => {
        gatewayRef.current = null;
        throw error;
      });
    }
    await connectRef.current;
  };

  const sendDirect = async (content: string) => {
    const clientMessageId = makeClientMessageId();
    await legacySendMessage({
      workspaceId,
      sessionId,
      fromUser: true,
      content,
      role: "user",
      state: "sending",
      externalMessageId: clientMessageId,
    });

    try {
      await ensureDirectGatewayConnected();
      const response = await gatewayRef.current!.sendChat({
        sessionKey: agent.sessionKey,
        content,
        clientMessageId,
      });

      await upsertGatewayEvent({
        workspaceId,
        sessionKey: agent.sessionKey,
        eventId: `direct.user.ack.${clientMessageId}`,
        eventType: "chat.send.ack.user",
        payload:
          typeof response === "object" && response !== null
            ? (response as Record<string, unknown>)
            : { response },
        message: {
          externalMessageId: clientMessageId,
          role: "user",
          fromUser: true,
          content,
          state: "completed",
        },
        sessionStatus: "active",
      });

      const assistantText = pickText(response);
      const runId = pickRunId(response);
      let assistantIngested = false;

      if (assistantText) {
        await upsertGatewayEvent({
          workspaceId,
          sessionKey: agent.sessionKey,
          eventId: `direct.assistant.ack.${clientMessageId}`,
          eventType: "chat.send.ack.assistant",
          payload:
            typeof response === "object" && response !== null
              ? (response as Record<string, unknown>)
              : { response },
          message: {
            externalMessageId: runId
              ? `${runId}:assistant`
              : `${clientMessageId}:assistant`,
            externalRunId: runId,
            role: "assistant",
            fromUser: false,
            content: assistantText,
            state: "completed",
          },
          sessionStatus: "idle",
        });
        assistantIngested = true;
      }

      // Always poll `chat.history` after send to ingest tool calls/results.
      // Also use it as a fallback for assistant text if not already ingested.
      for (const delayMs of [750, 1500, 3000]) {
        await new Promise((r) => setTimeout(r, delayMs));
        const history = await gatewayRef.current!.getChatHistory({
          sessionKey: agent.sessionKey,
          limit: 25,
        });

        // Ingest tool call/result messages from history so they show up in the chat
        // timeline like Control UI (exec cards).
        const traces = extractExecTracesFromHistory(history);
        for (const t of traces) {
          const eventAt = t.timestamp ?? t.resultTimestamp;
          const state =
            t.status === "error" ||
            (t.resultText && t.resultText.includes("Server Error"))
              ? "failed"
              : t.status === "completed"
                ? "completed"
                : "streaming";

          await upsertGatewayEvent({
            workspaceId,
            sessionKey: agent.sessionKey,
            eventId: `direct.history.exec.${t.toolCallId}.${delayMs}`,
            eventType: "chat.history.exec",
            eventAt,
            payload:
              typeof history === "object" && history !== null
                ? (history as Record<string, unknown>)
                : { history },
            message: {
              externalMessageId: t.toolCallId,
              role: "tool",
              fromUser: false,
              // Store command as content; UI renders it as an exec card.
              content: t.command ?? `${t.toolName} (missing command)`,
              state,
              errorMessage:
                state === "failed" ? t.resultText ?? "Tool failed" : undefined,
            },
            sessionStatus: state === "failed" ? "error" : "active",
          });
        }

        // Ingest displayable user/system messages that Control UI shows (e.g. HEARTBEAT prompt).
        const display = extractDisplayMessagesFromHistory(history);
        for (const m of display) {
          // Avoid duplicating the just-sent user message; we already inserted it.
          if (m.externalMessageId === clientMessageId) continue;
          await upsertGatewayEvent({
            workspaceId,
            sessionKey: agent.sessionKey,
            eventId: `direct.history.msg.${m.externalMessageId}.${delayMs}`,
            eventType: "chat.history.message",
            eventAt: m.eventAt,
            payload:
              typeof history === "object" && history !== null
                ? (history as Record<string, unknown>)
                : { history },
            message: {
              externalMessageId: m.externalMessageId,
              role: m.role,
              fromUser: m.fromUser,
              content: m.content,
              state: "completed",
            },
            sessionStatus: "active",
          });
        }

        if (assistantIngested) continue;
        const assistant = pickLatestAssistantFromHistory(history);
        if (!assistant) continue;

        const externalRunId = assistant.runId ?? runId;
        const externalMessageId =
          assistant.messageId ||
          (externalRunId
            ? `${externalRunId}:assistant`
            : `${clientMessageId}:assistant`);

        await upsertGatewayEvent({
          workspaceId,
          sessionKey: agent.sessionKey,
          eventId: `direct.history.assistant.${clientMessageId}.${delayMs}`,
          eventType: "chat.history.assistant",
          payload:
            typeof history === "object" && history !== null
              ? (history as Record<string, unknown>)
              : { history },
          message: {
            externalMessageId,
            externalRunId,
            role: "assistant",
            fromUser: false,
            content: assistant.text,
            state: "completed",
          },
          sessionStatus: "idle",
        });
        assistantIngested = true;
      }
    } catch (error) {
      await upsertGatewayEvent({
        workspaceId,
        sessionKey: agent.sessionKey,
        eventId: `direct.user.fail.${clientMessageId}`,
        eventType: "chat.send.error",
        payload: {
          error:
            error instanceof Error ? error.message : "Unknown gateway error",
        },
        message: {
          externalMessageId: clientMessageId,
          role: "user",
          fromUser: true,
          content,
          state: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown gateway error",
        },
        sessionStatus: "error",
      });
    }
  };

  // Background history sync to pick up agent-initiated runs (heartbeat/cron) where
  // tool calls are only available via `chat.history`.
  useEffect(() => {
    if (!useDirectWs) return;
    if (!historyPollMs || Number.isNaN(historyPollMs) || historyPollMs < 1000)
      return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await ensureDirectGatewayConnected();
        const history = await gatewayRef.current!.getChatHistory({
          sessionKey: agent.sessionKey,
          limit: 50,
        });

        const traces = extractExecTracesFromHistory(history);
        for (const t of traces) {
          await upsertGatewayEvent({
            workspaceId,
            sessionKey: agent.sessionKey,
            eventId: `sync.history.exec.${t.toolCallId}`,
            eventType: "chat.history.exec",
            eventAt: t.timestamp ?? t.resultTimestamp,
            payload:
              typeof history === "object" && history !== null
                ? (history as Record<string, unknown>)
                : { history },
            message: {
              externalMessageId: t.toolCallId,
              role: "tool",
              fromUser: false,
              content: t.command ?? `${t.toolName} (missing command)`,
              state:
                t.status === "error" ||
                (t.resultText && t.resultText.includes("Server Error"))
                  ? "failed"
                  : "completed",
              errorMessage:
                t.status === "error" ? t.resultText ?? "Tool failed" : undefined,
            },
            sessionStatus: "active",
          });
        }

        const display = extractDisplayMessagesFromHistory(history);
        for (const m of display) {
          await upsertGatewayEvent({
            workspaceId,
            sessionKey: agent.sessionKey,
            eventId: `sync.history.msg.${m.externalMessageId}`,
            eventType: "chat.history.message",
            eventAt: m.eventAt,
            payload:
              typeof history === "object" && history !== null
                ? (history as Record<string, unknown>)
                : { history },
            message: {
              externalMessageId: m.externalMessageId,
              role: m.role,
              fromUser: m.fromUser,
              content: m.content,
              state: "completed",
            },
            sessionStatus: "active",
          });
        }
      } catch {
        // Ignore; next tick will retry.
      }
    };

    const interval = setInterval(() => void tick(), historyPollMs);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [useDirectWs, historyPollMs, agent.sessionKey, workspaceId]);

  const handleSend = async (content: string) => {
    await sendDirect(content);
  };

  const handleRetry = async (externalMessageId: string | undefined) => {
    if (!externalMessageId) return;
    const failedMessage = messages.find(
      (m) => m.externalMessageId === externalMessageId,
    );
    if (!failedMessage) return;
    await sendDirect(failedMessage.content);
  };

  const activeRun = messages
    .slice()
    .reverse()
    .find((m) => m.externalRunId && m.state === "streaming");

  const handleAbort = async () => {
    if (!activeRun?.externalRunId) return;
    const clientMessageId = makeClientMessageId();
    try {
      await ensureDirectGatewayConnected();
      await gatewayRef.current!.abortChat({
        sessionKey: agent.sessionKey,
        runId: activeRun.externalRunId,
        clientMessageId,
      });
    } finally {
      await upsertGatewayEvent({
        workspaceId,
        sessionKey: agent.sessionKey,
        eventId: `direct.abort.${clientMessageId}`,
        eventType: "chat.abort",
        payload: { runId: activeRun.externalRunId },
        message: {
          externalMessageId:
            activeRun.externalMessageId ?? `${activeRun.externalRunId}:assistant`,
          externalRunId: activeRun.externalRunId,
          role: "assistant",
          fromUser: false,
          content: activeRun.content,
          state: "aborted",
        },
        sessionStatus: "idle",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-0 overflow-hidden h-[calc(100dvh-3.5rem)]">
      <div className="flex items-center gap-3 border-b border-border-default bg-bg-secondary px-6 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary text-xl">
          {agent.emoji}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            {agent.name}
          </h2>
          <p className="text-xs text-text-muted">{agent.role}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {activeRun?.externalRunId && canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleAbort}
            >
              Abort Run
            </Button>
          )}
          <span
            className={`h-2 w-2 rounded-full ${agent.status === "active" ? "bg-status-active" : agent.status === "error" ? "bg-status-blocked" : agent.status === "offline" ? "bg-text-muted" : "bg-status-idle"}`}
          />
          <span className="text-xs text-text-muted capitalize">
            {agent.status}
          </span>
        </div>
      </div>
      <div className="relative flex-1 min-h-0">
        <ScrollArea className="h-full bg-bg-secondary" viewportRef={viewportRef}>
          <div className="space-y-4 p-6">
            {messages.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={`Start chatting with ${agent.name}`}
                description="Messages are stored and synced in real-time"
              />
            ) : (
              messages.map((msg) => (
                <div key={msg._id}>
                  <ChatMessage
                    message={msg}
                    agentEmoji={agent.emoji}
                    agentName={agent.name}
                    userName={me?.name}
                    userImage={me?.image ?? undefined}
                    eventsForSession={eventsForSession}
                  />
                  {msg.state === "failed" && msg.externalMessageId && canEdit && (
                    <div className="mt-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleRetry(msg.externalMessageId)}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {showScrollDown && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute bottom-4 right-4 z-10 h-9 w-9 rounded-full shadow-md"
            onClick={() => scrollToBottom("smooth")}
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border-default bg-bg-secondary">
        <ChatInput
          onSend={handleSend}
          placeholder={`Message ${agent.name}...`}
          disabled={!canEdit}
        />
      </div>
    </div>
  );
}
