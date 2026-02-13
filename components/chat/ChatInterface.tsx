"use client";

import { useQuery } from "convex/react";
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
} from "@/lib/openclaw-gateway-client";
import { ChatInput } from "./ChatInput";
import { ChatMessage, type UiChatMessage } from "./ChatMessage";

interface ChatInterfaceProps {
  agent: Pick<Doc<"agents">, "name" | "emoji" | "role" | "status" | "sessionKey">;
}

export function ChatInterface({ agent }: ChatInterfaceProps) {
  const { workspaceId, canEdit, membershipId } = useWorkspace();
  const members =
    useQuery(api.workspaces.getMembers, { workspaceId }) ?? [];
  const me = useMemo(
    () => members.find((m) => m._id === membershipId),
    [members, membershipId],
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const gatewayRef = useRef<OpenClawBrowserGatewayClient | null>(null);
  const connectRef = useRef<Promise<void> | null>(null);
  const [localMessages, setLocalMessages] = useState<UiChatMessage[]>([]);
  const localMessagesRef = useRef<UiChatMessage[]>([]);
  const localIndexRef = useRef<Map<string, number>>(new Map());

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
    if (localMessages.length === 0) return;
    if (atBottomRef.current) scrollToBottom("auto");
  }, [localMessages.length]);

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

  type QueueItem = { clientMessageId: string; content: string };
  const sendQueueRef = useRef<QueueItem[]>([]);
  const sendingRef = useRef(false);
  const [queuedCount, setQueuedCount] = useState(0);

  const rebuildIndex = (next: UiChatMessage[]) => {
    const map = new Map<string, number>();
    for (let i = 0; i < next.length; i++) {
      const key = next[i].externalMessageId ?? next[i].id;
      map.set(key, i);
    }
    localIndexRef.current = map;
  };

  const upsertLocal = (partial: Omit<UiChatMessage, "id"> & { id?: string }) => {
    setLocalMessages((prev) => {
      const key = partial.externalMessageId ?? partial.id;
      if (!key) return prev;

      const idx = localIndexRef.current.get(key);
      const now = Date.now();

      if (idx === undefined) {
        const nextMsg: UiChatMessage = {
          id: partial.id ?? key,
          fromUser: partial.fromUser,
          role: partial.role,
          content: partial.content ?? "",
          createdAt: partial.createdAt ?? now,
          state: partial.state,
          errorMessage: partial.errorMessage,
          externalMessageId: partial.externalMessageId,
          externalRunId: partial.externalRunId,
        };
        const next = [...prev, nextMsg].sort((a, b) => a.createdAt - b.createdAt);
        rebuildIndex(next);
        return next;
      }

      const existing = prev[idx];
      const nextContent =
        partial.state === "streaming" && partial.content && existing.content
          ? partial.content
          : (partial.content ?? existing.content);

      const updated: UiChatMessage = {
        ...existing,
        ...partial,
        id: existing.id,
        content: nextContent,
        createdAt: existing.createdAt,
      };
      const next = prev.slice();
      next[idx] = updated;
      rebuildIndex(next);
      return next;
    });
  };

  useEffect(() => {
    localMessagesRef.current = localMessages;
  }, [localMessages]);

  const hasSimilarUserMessage = (content: string, ts: number) => {
    // De-dupe only near-real-time echoes (history/WS repeating what the UI already showed).
    // Do not de-dupe across large time spans to avoid hiding legitimate repeats.
    const windowMs = 60_000;
    const normalize = (s: string) =>
      s
        .replace(/\r\n/g, "\n")
        // Ignore trailing whitespace differences which can happen between optimistic
        // UI content and history-normalized content.
        .replace(/[ \t]+\n/g, "\n")
        .trim();
    const needle = normalize(content);
    return localMessagesRef.current.some(
      (m) =>
        m.role === "user" &&
        m.fromUser &&
        normalize(m.content) === needle &&
        Math.abs((m.createdAt ?? 0) - ts) <= windowMs,
    );
  };

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
          // Render streaming deltas locally (no Convex writes).
          const mapped = mapGatewayEventForIngest(event, makeClientMessageId());
          if (!mapped?.message) return;

          const isPrimary = mapped.sessionKey === agent.sessionKey;
          const isCron =
            includeCron &&
            mapped.sessionKey.startsWith(`${agent.sessionKey}:cron:`);
          if (!isPrimary && !isCron) return;

          // Mirror cron/heartbeat runs into the primary chat.
          const sessionKey = isCron ? agent.sessionKey : mapped.sessionKey;
          if (sessionKey !== agent.sessionKey) return;

          const msg = mapped.message;
          if (!msg.externalMessageId) return;

          // Avoid duplicate user echoes (we render user messages locally).
          if (msg.fromUser) return;

          // We intentionally do NOT create tool cards from raw WS events to avoid noise.
          if (msg.role === "tool") return;

          // Normalize assistant IDs by runId when available to avoid duplicates between
          // different gateway messageId formats and history fallback.
          const externalMessageId =
            msg.role === "assistant" && msg.externalRunId
              ? `${msg.externalRunId}:assistant`
              : msg.externalMessageId;

          upsertLocal({
            id: externalMessageId,
            externalMessageId,
            externalRunId: msg.externalRunId,
            fromUser: msg.fromUser,
            role: msg.role,
            content: msg.content ?? "",
            state: msg.state,
            createdAt: mapped.eventAt ?? Date.now(),
            errorMessage: msg.errorMessage,
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

  const sendDirect = async (content: string, clientMessageId?: string) => {
    const id = clientMessageId ?? makeClientMessageId();

    // Optimistic local echo.
    upsertLocal({
      id,
      externalMessageId: id,
      fromUser: true,
      role: "user",
      content,
      state: "sending",
      createdAt: Date.now(),
    });

    try {
      await ensureDirectGatewayConnected();
      await gatewayRef.current!.sendChat({
        sessionKey: agent.sessionKey,
        content,
        clientMessageId: id,
      });

      upsertLocal({
        id,
        externalMessageId: id,
        fromUser: true,
        role: "user",
        content,
        state: "completed",
        createdAt: Date.now(),
      });

      // Poll `chat.history` after send to hydrate tools + any missing messages.
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

          const state =
            t.status === "error" ||
            (t.resultText && t.resultText.includes("Server Error"))
              ? "failed"
              : "completed";

          upsertLocal({
            id: toolCallId,
            externalMessageId: toolCallId,
            fromUser: false,
            role: "tool",
            content: t.command ?? `${t.toolName} (missing command)`,
            state,
            // Store output here for ToolOutputSheet.
            errorMessage: t.resultText,
            createdAt: t.timestamp ?? t.resultTimestamp ?? Date.now(),
          });
        }

        const display = extractDisplayMessagesFromHistory(history);
        for (const m of display) {
          if (!m.externalMessageId) continue;
          if (m.externalMessageId === id) continue;

          // Skip near-real-time duplicates of the user message we already displayed.
          if (
            m.role === "user" &&
            hasSimilarUserMessage(m.content, m.eventAt ?? Date.now())
          ) {
            continue;
          }

            upsertLocal({
              id: m.externalMessageId,
              externalMessageId: m.externalMessageId,
              fromUser: m.fromUser,
              role: m.role,
              content: m.content,
              state: "completed",
              createdAt: m.eventAt ?? Date.now(),
            });
          }

        // Fallback: if WS streaming is not delivering, at least show the latest assistant.
        const assistant = pickLatestAssistantFromHistory(history);
        if (assistant) {
          const externalMessageId =
            assistant.messageId ??
            (assistant.runId ? `${assistant.runId}:assistant` : `${id}:assistant`);
          upsertLocal({
            id: externalMessageId,
            externalMessageId,
            externalRunId: assistant.runId,
            fromUser: false,
            role: "assistant",
            content: assistant.text,
            state: "completed",
            createdAt: Date.now(),
          });
        }
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown gateway error";
      upsertLocal({
        id,
        externalMessageId: id,
        fromUser: true,
        role: "user",
        content,
        state: "failed",
        errorMessage: msg,
        createdAt: Date.now(),
      });
    }
  };

  const isAgentResponding = useMemo(() => {
    // "Responding" = any assistant message currently streaming.
    return localMessages.some(
      (m) => m.role === "assistant" && m.state === "streaming",
    );
  }, [localMessages]);

  const activeRun = useMemo(() => {
    return localMessages
      .slice()
      .reverse()
      .find((m) => m.role === "assistant" && m.state === "streaming" && m.externalRunId);
  }, [localMessages]);

  const enqueueOrSend = async (content: string) => {
    // If the agent is responding or we're already sending, enqueue.
    if (isAgentResponding || sendingRef.current) {
      const clientMessageId = makeClientMessageId();
      sendQueueRef.current.push({ clientMessageId, content });
      setQueuedCount(sendQueueRef.current.length);
      // Show a local "queued" marker for user visibility.
      upsertLocal({
        id: clientMessageId,
        externalMessageId: clientMessageId,
        fromUser: true,
        role: "user",
        content,
        state: "queued",
        createdAt: Date.now(),
      });
      return;
    }

    sendingRef.current = true;
    try {
      await sendDirect(content);
    } finally {
      sendingRef.current = false;
    }
  };

  // Drain the queue when the agent finishes responding.
  useEffect(() => {
    if (isAgentResponding) return;
    if (sendingRef.current) return;
    if (sendQueueRef.current.length === 0) return;

    const next = sendQueueRef.current.shift();
    setQueuedCount(sendQueueRef.current.length);
    if (!next) return;
    // Send using the reserved id so the queued bubble becomes the sent bubble.
    sendingRef.current = true;
    void sendDirect(next.content, next.clientMessageId).finally(() => {
      sendingRef.current = false;
    });
  }, [isAgentResponding]);

  // Background history sync to pick up agent-initiated runs (heartbeat/cron) where
  // tool calls are only available via `chat.history`.
  useEffect(() => {
    if (!useDirectWs) return;
    if (!historyPollMs || Number.isNaN(historyPollMs) || historyPollMs < 1000) {
      // Still do a one-time hydration on mount for history.
      void (async () => {
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
            upsertLocal({
              id: toolCallId,
              externalMessageId: toolCallId,
              fromUser: false,
              role: "tool",
              content: t.command ?? `${t.toolName} (missing command)`,
              state:
                t.status === "error" ||
                (t.resultText && t.resultText.includes("Server Error"))
                  ? "failed"
                  : "completed",
              errorMessage: t.resultText,
              createdAt: t.timestamp ?? t.resultTimestamp ?? Date.now(),
            });
          }
          const display = extractDisplayMessagesFromHistory(history);
          for (const m of display) {
            if (
              m.role === "user" &&
              hasSimilarUserMessage(m.content, m.eventAt ?? Date.now())
            ) {
              continue;
            }
            upsertLocal({
              id: m.externalMessageId,
              externalMessageId: m.externalMessageId,
              fromUser: m.fromUser,
              role: m.role,
              content: m.content,
              state: "completed",
              createdAt: m.eventAt ?? Date.now(),
            });
          }
        } catch {
          // ignore
        }
      })();
      return;
    }

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
          upsertLocal({
            id: toolCallId,
            externalMessageId: toolCallId,
            fromUser: false,
            role: "tool",
            content: t.command ?? `${t.toolName} (missing command)`,
            state:
              t.status === "error" ||
              (t.resultText && t.resultText.includes("Server Error"))
                ? "failed"
                : "completed",
            errorMessage: t.resultText,
            createdAt: t.timestamp ?? t.resultTimestamp ?? Date.now(),
          });
        }

        const display = extractDisplayMessagesFromHistory(history);
        for (const m of display) {
          if (!m.externalMessageId) continue;
          if (
            m.role === "user" &&
            hasSimilarUserMessage(m.content, m.eventAt ?? Date.now())
          ) {
            continue;
          }
          upsertLocal({
            id: m.externalMessageId,
            externalMessageId: m.externalMessageId,
            fromUser: m.fromUser,
            role: m.role,
            content: m.content,
            state: "completed",
            createdAt: m.eventAt ?? Date.now(),
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
  }, [useDirectWs, historyPollMs, agent.sessionKey]);

  const handleSend = async (content: string) => {
    await enqueueOrSend(content);
  };

  const handleRetry = async (externalMessageId: string | undefined) => {
    if (!externalMessageId) return;
    const failedMessage = localMessages.find(
      (m) => m.externalMessageId === externalMessageId,
    );
    if (!failedMessage) return;
    await sendDirect(failedMessage.content);
  };

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
      // Clear any queued messages when stopping, matching Control UI behavior.
      sendQueueRef.current = [];
      setQueuedCount(0);
      upsertLocal({
        id:
          activeRun.externalMessageId ?? `${activeRun.externalRunId}:assistant`,
        externalMessageId:
          activeRun.externalMessageId ?? `${activeRun.externalRunId}:assistant`,
        externalRunId: activeRun.externalRunId,
        fromUser: false,
        role: "assistant",
        content: activeRun.content,
        state: "aborted",
        createdAt: Date.now(),
      });
    } finally {
      // no-op
    }
  };

  return (
    <div className="flex flex-col min-h-0 overflow-hidden h-[calc(100dvh-3.5rem)]">
      <div className="flex items-center gap-3 border-b border-border-default bg-bg-secondary px-4 py-2 sm:px-6 sm:py-3">
        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-bg-tertiary text-lg sm:text-xl">
          {agent.emoji}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            {agent.name}
          </h2>
          <p className="text-xs text-text-muted hidden sm:block">{agent.role}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {activeRun?.externalRunId && canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleAbort}
            >
              Stop
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
          <div className="space-y-3 p-3 sm:space-y-4 sm:p-6">
            {localMessages.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={`Start chatting with ${agent.name}`}
                description="Messages stream directly from OpenClaw"
              />
            ) : (
              localMessages.map((msg) => (
                <div key={msg.id}>
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
            className="absolute bottom-24 right-4 z-10 h-9 w-9 rounded-full shadow-md sm:bottom-4"
            onClick={() => scrollToBottom("smooth")}
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border-default bg-bg-secondary pb-[env(safe-area-inset-bottom)]">
        <ChatInput
          onSend={handleSend}
          placeholder={`Message ${agent.name}...`}
          disabled={!canEdit}
          statusText={
            queuedCount > 0
              ? `Queued: ${queuedCount} (will send after the agent finishes)`
              : isAgentResponding
                ? "Agent is responding… new messages will be queued"
                : undefined
          }
        />
      </div>
    </div>
  );
}
