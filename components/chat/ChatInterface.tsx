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
  const legacySendMessage = useMutation(api.chatMessages.send);
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
        // Intentionally no-op: do not mirror per-token WS deltas into Convex.
        // We persist only "complete" artifacts via chat.history (see sendDirect + optional poll).
        async () => {},
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

    // Avoid repeated inserts when polling history multiple times.
    const seenExternal = new Set(
      messages
        .map((m) => m.externalMessageId)
        .filter((x): x is string => typeof x === "string" && x.length > 0),
    );

    // Store the user message once as completed. Any "sending" indicator is UI-only.
    if (!seenExternal.has(clientMessageId)) {
      await legacySendMessage({
        workspaceId,
        sessionId,
        fromUser: true,
        content,
        role: "user",
        state: "completed",
        externalMessageId: clientMessageId,
      });
      seenExternal.add(clientMessageId);
    }

    try {
      await ensureDirectGatewayConnected();
      const response = await gatewayRef.current!.sendChat({
        sessionKey: agent.sessionKey,
        content,
        clientMessageId,
      });

      const assistantText = pickText(response);
      const runId = pickRunId(response);

      // Best-effort: if sendChat returns assistant text, persist it once.
      if (assistantText) {
        const assistantExternal = runId
          ? `${runId}:assistant`
          : `${clientMessageId}:assistant`;
        if (!seenExternal.has(assistantExternal)) {
          await legacySendMessage({
            workspaceId,
            sessionId,
            fromUser: false,
            content: assistantText,
            role: "assistant",
            state: "completed",
            externalMessageId: assistantExternal,
            externalRunId: runId ?? undefined,
          });
          seenExternal.add(assistantExternal);
        }
      }

      // Poll `chat.history` after send to persist tool calls/results and
      // displayable system/user messages (e.g. HEARTBEAT prompt).
      for (const delayMs of [750, 1500, 3000]) {
        await new Promise((r) => setTimeout(r, delayMs));
        const history = await gatewayRef.current!.getChatHistory({
          sessionKey: agent.sessionKey,
          limit: 25,
        });

        const traces = extractExecTracesFromHistory(history);
        for (const t of traces) {
          const toolCallId = t.toolCallId;
          if (!toolCallId) continue;
          if (seenExternal.has(toolCallId)) continue;

          const state =
            t.status === "error" ||
            (t.resultText && t.resultText.includes("Server Error"))
              ? "failed"
              : "completed";

          await legacySendMessage({
            workspaceId,
            sessionId,
            fromUser: false,
            role: "tool",
            state,
            externalMessageId: toolCallId,
            content: t.command ?? `${t.toolName} (missing command)`,
            // Store tool output in errorMessage (even on success) so ToolOutputSheet
            // doesn't need chatEvents/raw payloads.
            errorMessage: t.resultText,
          } as any);
          seenExternal.add(toolCallId);
        }

        const display = extractDisplayMessagesFromHistory(history);
        for (const m of display) {
          if (!m.externalMessageId) continue;
          if (m.externalMessageId === clientMessageId) continue;
          if (seenExternal.has(m.externalMessageId)) continue;

          await legacySendMessage({
            workspaceId,
            sessionId,
            fromUser: m.fromUser,
            role: m.role,
            state: "completed",
            externalMessageId: m.externalMessageId,
            content: m.content,
          } as any);
          seenExternal.add(m.externalMessageId);
        }

        // Fallback: persist final assistant message if not already saved.
        const assistant = pickLatestAssistantFromHistory(history);
        if (!assistant) continue;

        const externalRunId = assistant.runId ?? runId;
        const externalMessageId =
          assistant.messageId ||
          (externalRunId
            ? `${externalRunId}:assistant`
            : `${clientMessageId}:assistant`);

        if (seenExternal.has(externalMessageId)) continue;
        await legacySendMessage({
          workspaceId,
          sessionId,
          fromUser: false,
          role: "assistant",
          state: "completed",
          externalMessageId,
          externalRunId: externalRunId ?? undefined,
          content: assistant.text,
        } as any);
        seenExternal.add(externalMessageId);
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown gateway error";
      await legacySendMessage({
        workspaceId,
        sessionId,
        fromUser: false,
        role: "system",
        state: "completed",
        externalMessageId: `system.error.${clientMessageId}`,
        content: `Send failed: ${msg}`,
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
          const toolCallId = t.toolCallId;
          if (!toolCallId) continue;
          if (messages.some((m) => m.externalMessageId === toolCallId)) continue;

          await legacySendMessage({
            workspaceId,
            sessionId,
            fromUser: false,
            role: "tool",
            state:
              t.status === "error" ||
              (t.resultText && t.resultText.includes("Server Error"))
                ? "failed"
                : "completed",
            externalMessageId: toolCallId,
            content: t.command ?? `${t.toolName} (missing command)`,
            errorMessage: t.resultText,
          } as any);
        }

        const display = extractDisplayMessagesFromHistory(history);
        for (const m of display) {
          if (!m.externalMessageId) continue;
          if (messages.some((x) => x.externalMessageId === m.externalMessageId))
            continue;

          await legacySendMessage({
            workspaceId,
            sessionId,
            fromUser: m.fromUser,
            role: m.role,
            state: "completed",
            externalMessageId: m.externalMessageId,
            content: m.content,
          } as any);
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
  }, [useDirectWs, historyPollMs, agent.sessionKey, workspaceId, sessionId, messages]);

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
      await legacySendMessage({
        workspaceId,
        sessionId,
        fromUser: false,
        role: "assistant",
        state: "aborted",
        externalMessageId:
          activeRun.externalMessageId ?? `${activeRun.externalRunId}:assistant`,
        externalRunId: activeRun.externalRunId,
        content: activeRun.content,
      });
    } finally {
      // no-op
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
