"use client";

import { useQuery } from "convex/react";
import { ChevronDown, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  mapGatewayEventForIngest,
  type OpenClawConnectionStatus,
  OpenClawBrowserGatewayClient,
  extractDisplayMessagesFromHistory,
  extractExecTracesFromHistory,
  pickHistoryMessages,
  pickRunId,
  pickText,
} from "@/lib/openclaw-gateway-client";
import { clearChatDraft, consumeChatDraft } from "@/lib/chatDraft";
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
  const [gatewayBlock, setGatewayBlock] = useState<OpenClawConnectionStatus | null>(null);
  const [showGatewayPanel, setShowGatewayPanel] = useState(false);
  const [gatewayDefaultModel, setGatewayDefaultModel] = useState<string | null>(null);
  const [gatewayModelProvider, setGatewayModelProvider] = useState<string | null>(null);
  const [gatewayChannels, setGatewayChannels] = useState<string[]>([]);
  const [gatewayAgentCount, setGatewayAgentCount] = useState<number | null>(null);
  const localMessagesRef = useRef<UiChatMessage[]>([]);
  const localIndexRef = useRef<Map<string, number>>(new Map());

  // Direct WS is now mandatory for chat.
  const useDirectWs = true;

  const openclawConfig = useQuery(
    api.openclaw.getClientConfig,
    canEdit ? { workspaceId } : "skip",
  );
  const includeCron = openclawConfig?.includeCron ?? false;
  const historyPollMs = openclawConfig?.historyPollMs ?? 0;

  const canChatBase = Boolean(canEdit && openclawConfig && openclawConfig.wsUrl);
  const gatewayBlocked = Boolean(
    gatewayBlock &&
      gatewayBlock.state !== "CONNECTED" &&
      (gatewayBlock.state === "PAIRING_REQUIRED" ||
        gatewayBlock.state === "PAIRING_PENDING" ||
        gatewayBlock.state === "SCOPES_INSUFFICIENT" ||
        gatewayBlock.state === "INVALID_CONFIG"),
  );
  const canChat = canChatBase && !gatewayBlocked;
  const gatewayConfigKey = useMemo(
    () => (openclawConfig ? JSON.stringify(openclawConfig) : ""),
    [openclawConfig],
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

  // Reset gateway connection when config changes (wsUrl/token/etc).
  useEffect(() => {
    void gatewayRef.current?.disconnect();
    gatewayRef.current = null;
    connectRef.current = null;
    setGatewayDefaultModel(null);
    setGatewayModelProvider(null);
    setGatewayChannels([]);
    setGatewayAgentCount(null);
    setGatewayBlock(null);
  }, [gatewayConfigKey]);

  const parseRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };

  const makeClientMessageId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  type QueueItem = { clientMessageId: string; content: string };
  const sendQueueRef = useRef<QueueItem[]>([]);
  const sendingRef = useRef(false);
  const [queuedCount, setQueuedCount] = useState(0);

  const draftKey = useMemo(
    () => `${String(workspaceId)}:${agent.sessionKey}`,
    [workspaceId, agent.sessionKey],
  );
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(
      consumeChatDraft({
        workspaceId: String(workspaceId),
        sessionKey: agent.sessionKey,
      }),
    );
  }, [draftKey, workspaceId, agent.sessionKey]);

  const rebuildIndex = (next: UiChatMessage[]) => {
    const map = new Map<string, number>();
    for (let i = 0; i < next.length; i++) {
      const key = next[i].externalMessageId ?? next[i].id;
      map.set(key, i);
    }
    localIndexRef.current = map;
  };

  const normalizeChatText = (s: string) =>
    s
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();

  const normalizeForDedupe = (s: string) =>
    normalizeChatText(s).replace(/\s+/g, " ").trim();

  const richnessScore = (s: string) => {
    // Prefer content that preserves structure (newlines/code fences), then length.
    const newlines = (s.match(/\n/g) ?? []).length;
    const fences = (s.match(/```/g) ?? []).length;
    return fences * 500 + newlines * 20 + s.length;
  };

  const preferRicherContent = (a: string, b: string) =>
    richnessScore(b) > richnessScore(a) ? b : a;

  const stateRank = (s: UiChatMessage["state"] | undefined) => {
    // Higher = more "final"/informative.
    switch (s) {
      case "failed":
        return 50;
      case "aborted":
        return 40;
      case "completed":
        return 30;
      case "streaming":
        return 20;
      case "sending":
        return 10;
      case "queued":
        return 5;
      default:
        return 0;
    }
  };

  const collapseNearDuplicates = (messages: UiChatMessage[]) => {
    if (messages.length < 2) return messages;

    const out: UiChatMessage[] = [];
    const windowMs = 5_000; // tight: only collapse immediate duplicates

    for (const m of messages) {
      const last = out[out.length - 1];
      if (!last) {
        out.push(m);
        continue;
      }

      const isUserOrAssistant =
        (m.role === "user" && m.fromUser) ||
        (m.role === "assistant" && !m.fromUser);
      const lastIsUserOrAssistant =
        (last.role === "user" && last.fromUser) ||
        (last.role === "assistant" && !last.fromUser);

      const sameKind =
        isUserOrAssistant &&
        lastIsUserOrAssistant &&
        m.role === last.role &&
        m.fromUser === last.fromUser;

      const sameText =
        normalizeForDedupe(m.content) === normalizeForDedupe(last.content);
      const closeInTime =
        Math.abs((m.createdAt ?? 0) - (last.createdAt ?? 0)) <= windowMs;

      // Only merge if they look like the same message arriving twice right away.
      if (sameKind && sameText && closeInTime) {
        const keep = last;
        const incoming = m;
        const merged: UiChatMessage = {
          ...keep,
          // Prefer the most advanced state.
          state:
            stateRank(incoming.state) > stateRank(keep.state)
              ? incoming.state
              : keep.state,
          // Prefer non-empty/longer content (streaming -> final).
          content: preferRicherContent(keep.content, incoming.content),
          errorMessage: incoming.errorMessage ?? keep.errorMessage,
          externalRunId: incoming.externalRunId ?? keep.externalRunId,
          externalMessageId: keep.externalMessageId ?? incoming.externalMessageId,
        };
        out[out.length - 1] = merged;
        continue;
      }

      out.push(m);
    }

    return out;
  };

  const findDuplicateIndex = (
    messages: UiChatMessage[],
    candidate: {
      role: UiChatMessage["role"];
      fromUser: boolean;
      content: string;
      createdAt?: number;
      externalRunId?: string;
    },
  ) => {
    // More aggressive than `collapseNearDuplicates`: handle cases where the same
    // message arrives via WS + history with different IDs, and tool cards may sit
    // between the duplicates (so they aren't adjacent).
    const windowMs = 2 * 60_000; // only collapse very near-time duplicates
    const ts = candidate.createdAt ?? Date.now();
    const needle = normalizeForDedupe(candidate.content ?? "");

    // Don't attempt to dedupe empty content; also skip tool messages (they already
    // have stable ids like toolCallId).
    if (!needle) return undefined;
    if (candidate.role === "tool") return undefined;

    // If we have a runId for assistant messages, prefer merging by runId first.
    if (candidate.role === "assistant" && candidate.externalRunId) {
      const byRun = messages.findIndex(
        (m) => m.role === "assistant" && m.externalRunId === candidate.externalRunId,
      );
      if (byRun !== -1) return byRun;
    }

    // Scan from the end (most likely duplicates are recent).
    // Cap the scan to keep this O(1)ish in steady-state.
    const scanLimit = 250;
    for (let i = messages.length - 1; i >= 0 && messages.length - i <= scanLimit; i--) {
      const m = messages[i];
      if (m.role !== candidate.role) continue;
      if (m.fromUser !== candidate.fromUser) continue;
      const mt = m.createdAt ?? 0;
      if (Math.abs(mt - ts) > windowMs) continue;
      if (normalizeForDedupe(m.content) !== needle) continue;
      return i;
    }

    return undefined;
  };

  const upsertLocal = (partial: Omit<UiChatMessage, "id"> & { id?: string }) => {
    setLocalMessages((prev) => {
      // Canonicalize assistant IDs by runId when possible to avoid duplicates coming
      // from different gateway id formats (WS vs history vs ack frames).
      const canonicalExternalId =
        partial.role === "assistant" && partial.externalRunId
          ? `${partial.externalRunId}:assistant`
          : partial.externalMessageId;

      const key = canonicalExternalId ?? partial.id;
      if (!key) return prev;

      let idx = localIndexRef.current.get(key);
      // Extra safety: if the key doesn't match but the runId does, merge anyway.
      if (
        idx === undefined &&
        partial.role === "assistant" &&
        partial.externalRunId
      ) {
        const byRunId = prev.findIndex(
          (m) => m.role === "assistant" && m.externalRunId === partial.externalRunId,
        );
        if (byRunId !== -1) idx = byRunId;
      }
      const now = Date.now();

      if (idx === undefined) {
        // If the same message arrived with a different id (common with WS vs history),
        // merge into the existing entry instead of adding a duplicate bubble.
        const dupIdx = findDuplicateIndex(prev, {
          role: partial.role,
          fromUser: partial.fromUser,
          content: partial.content ?? "",
          createdAt: partial.createdAt,
          externalRunId: partial.externalRunId,
        });
        if (dupIdx !== undefined) {
          const existingDup = prev[dupIdx];
        const merged: UiChatMessage = {
          ...existingDup,
          ...partial,
          id: existingDup.id,
            // Prefer the most advanced state.
            state:
              stateRank(partial.state) > stateRank(existingDup.state)
                ? partial.state
                : existingDup.state,
            // Prefer longer content (streaming -> final).
          content: preferRicherContent(
            existingDup.content,
            partial.content ?? "",
          ),
            // Promote the canonical ids when we learn them.
            externalRunId: partial.externalRunId ?? existingDup.externalRunId,
            externalMessageId:
              canonicalExternalId ??
              partial.externalMessageId ??
              existingDup.externalMessageId,
            errorMessage: partial.errorMessage ?? existingDup.errorMessage,
            createdAt: existingDup.createdAt,
          };

          const next = prev.slice();
          next[dupIdx] = merged;
          const collapsed = collapseNearDuplicates(
            next.slice().sort((a, b) => a.createdAt - b.createdAt),
          );
          rebuildIndex(collapsed);
          return collapsed;
        }

        const nextMsg: UiChatMessage = {
          id: partial.id ?? key,
          fromUser: partial.fromUser,
          role: partial.role,
          content: partial.content ?? "",
          createdAt: partial.createdAt ?? now,
          state: partial.state,
          errorMessage: partial.errorMessage,
          externalMessageId: canonicalExternalId ?? partial.externalMessageId,
          externalRunId: partial.externalRunId,
        };
        const next = collapseNearDuplicates(
          [...prev, nextMsg].sort((a, b) => a.createdAt - b.createdAt),
        );
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
          content: preferRicherContent(existing.content, nextContent),
          createdAt: existing.createdAt,
          externalMessageId:
            canonicalExternalId ?? partial.externalMessageId ?? existing.externalMessageId,
        };
      const next = prev.slice();
      next[idx] = updated;
      const collapsed = collapseNearDuplicates(
        next.slice().sort((a, b) => a.createdAt - b.createdAt),
      );
      rebuildIndex(collapsed);
      return collapsed;
    });
  };

  useEffect(() => {
    localMessagesRef.current = localMessages;
  }, [localMessages]);

  const hasSimilarUserMessage = (content: string, ts: number) => {
    // De-dupe only near-real-time echoes (history/WS repeating what the UI already showed).
    // Do not de-dupe across large time spans to avoid hiding legitimate repeats.
    const windowMs = 60_000;
    const needle = normalizeForDedupe(content);
    return localMessagesRef.current.some(
      (m) =>
        m.role === "user" &&
        m.fromUser &&
        normalizeForDedupe(m.content) === needle &&
        Math.abs((m.createdAt ?? 0) - ts) <= windowMs,
    );
  };

  const ensureDirectGatewayConnected = async () => {
    if (!openclawConfig) {
      throw new Error(
        "OpenClaw is not configured for this workspace. Go to Settings → OpenClaw.",
      );
    }
    if (!openclawConfig.wsUrl) {
      throw new Error("OpenClaw wsUrl is missing.");
    }

    if (!gatewayRef.current) {
      gatewayRef.current = new OpenClawBrowserGatewayClient(
        {
          wsUrl: openclawConfig.wsUrl,
          protocol: openclawConfig.protocol,
          authToken: openclawConfig.authToken,
          password: openclawConfig.password,
          clientId: openclawConfig.clientId,
          clientMode: openclawConfig.clientMode,
          clientPlatform: openclawConfig.clientPlatform,
          role: openclawConfig.role,
          scopes: openclawConfig.scopes,
          subscribeOnConnect: openclawConfig.subscribeOnConnect,
          subscribeMethod: openclawConfig.subscribeMethod,
        },
        async (event) => {
          if (
            (event as any)?.type === "event" &&
            (event as any)?.event === "health"
          ) {
            const payload = parseRecord((event as any)?.payload);
            if (payload) {
              const channelOrder = Array.isArray(payload.channelOrder)
                ? payload.channelOrder.filter((v): v is string => typeof v === "string")
                : [];
              const labelsRec = parseRecord(payload.channelLabels);
              if (channelOrder.length > 0 && labelsRec) {
                const labels = channelOrder.map((id) => {
                  const label = labelsRec[id];
                  return typeof label === "string" ? label : id;
                });
                setGatewayChannels(labels);
              }
              if (Array.isArray(payload.agents)) {
                setGatewayAgentCount(payload.agents.length);
              }

              const defaults = parseRecord(payload.defaults);
              const sessions = parseRecord(payload.sessions);
              const sessionDefaults = sessions
                ? parseRecord(sessions.defaults)
                : null;
              const modelFromHealth =
                (defaults && typeof defaults.model === "string" && defaults.model) ||
                (sessionDefaults &&
                  typeof sessionDefaults.model === "string" &&
                  sessionDefaults.model) ||
                null;
              const providerFromHealth =
                (defaults &&
                  typeof defaults.modelProvider === "string" &&
                  defaults.modelProvider) ||
                (sessionDefaults &&
                  typeof sessionDefaults.modelProvider === "string" &&
                  sessionDefaults.modelProvider) ||
                null;
              if (modelFromHealth) setGatewayDefaultModel(modelFromHealth);
              if (providerFromHealth) setGatewayModelProvider(providerFromHealth);
            }
          }

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
        const status = gatewayRef.current?.getConnectionStatus() ?? null;
        if (status) setGatewayBlock(status);
        gatewayRef.current = null;
        throw error;
      });
    }
    await connectRef.current;
    const status = gatewayRef.current?.getConnectionStatus() ?? null;
    if (status?.state === "CONNECTED") {
      setGatewayBlock(null);
    } else if (status) {
      setGatewayBlock(status);
    }
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
      const sendResult = await gatewayRef.current!.sendChat({
        sessionKey: agent.sessionKey,
        content,
        clientMessageId: id,
      });
      const expectedRunId = pickRunId(sendResult);

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

        // Fallback: if WS streaming is not delivering, only hydrate the assistant
        // message for THIS send's runId (avoid pulling in unrelated prior messages).
        if (expectedRunId) {
          const assistantKey = `${expectedRunId}:assistant`;
          const already = localIndexRef.current.get(assistantKey);
          const existing = already !== undefined ? localMessagesRef.current[already] : null;
          if (!existing || existing.state !== "completed") {
            const historyMessages = pickHistoryMessages(history);
            const match = historyMessages
              .slice()
              .reverse()
              .find((m) => {
                const role =
                  (typeof m.role === "string" && m.role) ||
                  (typeof m.author === "string" && m.author) ||
                  "assistant";
                return role === "assistant" && m.runId === expectedRunId;
              });
            if (match) {
              const text =
                (Array.isArray(match.content)
                  ? match.content
                      .filter(
                        (p: any) =>
                          p && typeof p === "object" && p.type === "text",
                      )
                      .map((p: any) =>
                        typeof p.text === "string" ? p.text : "",
                      )
                      .filter((t: string) => t.trim().length > 0)
                      .join("\n")
                  : null) ||
                pickText(match.content) ||
                pickText(match.text) ||
                pickText(match.message) ||
                pickText(match.reply);

              if (text && String(text).trim().length > 0) {
                const ts =
                  typeof (match as any).timestamp === "number"
                    ? (match as any).timestamp
                    : Date.now();
                upsertLocal({
                  id: assistantKey,
                  externalMessageId: assistantKey,
                  externalRunId: expectedRunId,
                  fromUser: false,
                  role: "assistant",
                  content: String(text),
                  state: "completed",
                  createdAt: ts,
                });
              }
            }
          }
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
    if (!canChat) return;
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
  }, [useDirectWs, canChat, historyPollMs, agent.sessionKey, gatewayConfigKey]);

  const handleSend = async (content: string) => {
    await enqueueOrSend(content);
    clearChatDraft({ workspaceId: String(workspaceId), sessionKey: agent.sessionKey });
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

  const gatewayFeatures = useMemo(() => {
    const features = ["Live stream", "History hydration", "Abort run"];
    if (includeCron) features.push("Cron mirroring");
    if (historyPollMs >= 1000) {
      features.push(`Recovery ${historyPollMs}ms`);
    }
    if (gatewayAgentCount && gatewayAgentCount > 0) {
      features.push(`${gatewayAgentCount} agents`);
    }
    if (gatewayChannels.length > 0) {
      features.push(`Channels: ${gatewayChannels.join(", ")}`);
    }
    if (gatewayDefaultModel) {
      const suffix = gatewayModelProvider ? ` (${gatewayModelProvider})` : "";
      features.push(`Model: ${gatewayDefaultModel}${suffix}`);
    }
    return features;
  }, [
    includeCron,
    historyPollMs,
    gatewayAgentCount,
    gatewayChannels,
    gatewayDefaultModel,
    gatewayModelProvider,
  ]);

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
          {canChatBase && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowGatewayPanel((v) => !v)}
            >
              OpenClaw
            </Button>
          )}
          {activeRun?.externalRunId && canChat && (
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
      {showGatewayPanel && canChatBase && (
        <div className="border-b border-border-default bg-bg-secondary px-4 py-2 sm:px-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span>Gateway model:</span>
              <span className="text-text-secondary">
                {gatewayDefaultModel
                  ? gatewayModelProvider
                    ? `${gatewayDefaultModel} (${gatewayModelProvider})`
                    : gatewayDefaultModel
                  : "Auto (from OpenClaw config)"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {gatewayFeatures.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-border-default bg-bg-tertiary px-2 py-0.5 text-[11px] text-text-secondary"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        <ScrollArea className="h-full bg-bg-secondary" viewportRef={viewportRef}>
          <div className="space-y-3 p-3 sm:space-y-4 sm:p-6">
            {!canEdit ? (
              <EmptyState
                icon={MessageSquare}
                title="Chat requires member access"
                description="Ask the workspace owner to upgrade your role."
              />
            ) : openclawConfig === undefined ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
              </div>
            ) : openclawConfig === null ? (
              <EmptyState
                icon={MessageSquare}
                title="OpenClaw is not configured"
                description="Set your gateway URL and token in Settings to enable chat."
              >
                <Button asChild className="bg-accent-orange hover:bg-accent-orange/90 text-white">
                  <Link href="/settings/openclaw">Open Settings</Link>
                </Button>
              </EmptyState>
            ) : gatewayBlocked ? (
              <EmptyState
                icon={MessageSquare}
                title="OpenClaw setup required"
                description={
                  gatewayBlock?.message ??
                  "Connection is blocked. Complete pairing and scope setup in OpenClaw settings."
                }
              >
                <Button asChild className="bg-accent-orange hover:bg-accent-orange/90 text-white">
                  <Link href="/settings/openclaw">Fix OpenClaw setup</Link>
                </Button>
              </EmptyState>
            ) : localMessages.length === 0 ? (
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
                  {msg.state === "failed" && msg.externalMessageId && canChat && (
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
          key={draftKey}
          onSend={handleSend}
          placeholder={`Message ${agent.name}...`}
          disabled={!canChat}
          initialValue={draft ?? undefined}
          initialValueKey={draftKey}
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
