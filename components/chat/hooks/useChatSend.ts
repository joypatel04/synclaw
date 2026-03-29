"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { consumeChatDraft } from "@/lib/chatDraft";
import {
  extractExecTracesFromHistory,
  type OpenClawBrowserGatewayClient,
  pickHistoryMessages,
  pickRunId,
  pickText,
} from "@/lib/openclaw-gateway-client";
import type { UiChatMessage, UpsertPartial } from "../types";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseChatSendParams {
  sessionKey: string;
  workspaceId: string;
  upsertLocal: (partial: UpsertPartial) => void;
  ensureConnected: () => Promise<void>;
  gateway: React.RefObject<OpenClawBrowserGatewayClient | null>;
  messagesRef: React.RefObject<UiChatMessage[]>;
  makeClientMessageId: () => string;
  hasSimilarUserMessage: (content: string, ts: number) => boolean;
}

export function useChatSend({
  sessionKey,
  workspaceId,
  upsertLocal,
  ensureConnected,
  gateway,
  messagesRef,
  makeClientMessageId,
}: UseChatSendParams) {
  type QueueItem = { clientMessageId: string; content: string };
  const sendQueueRef = useRef<QueueItem[]>([]);
  const sendingRef = useRef(false);
  const [queuedCount, setQueuedCount] = useState(0);

  // Draft recovery.
  const draftKey = useMemo(
    () => `${workspaceId}:${sessionKey}`,
    [workspaceId, sessionKey],
  );
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(
      consumeChatDraft({
        workspaceId: String(workspaceId),
        sessionKey,
      }),
    );
  }, [draftKey, workspaceId, sessionKey]);

  // ------------------------------------------------------------------
  // "Is agent responding?" derived from messages.
  // ------------------------------------------------------------------
  const localMessages = messagesRef.current;

  const isAgentResponding = useMemo(() => {
    return localMessages.some(
      (m) => m.role === "assistant" && m.state === "streaming",
    );
    // We deliberately depend on localMessages by identity; the ref updates each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMessages]);

  const activeRun = useMemo(() => {
    return localMessages
      .slice()
      .reverse()
      .find(
        (m) =>
          m.role === "assistant" && m.state === "streaming" && m.externalRunId,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMessages]);

  // ------------------------------------------------------------------
  // Direct send with history polling follow-up.
  // ------------------------------------------------------------------
  const sendDirect = useCallback(
    async (content: string, clientMessageId?: string) => {
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
        await ensureConnected();
        const sendResult = await gateway.current?.sendChat({
          sessionKey,
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

        // Poll history to hydrate tool cards + missing messages.
        for (const delayMs of [750, 1500, 3000]) {
          await new Promise((r) => setTimeout(r, delayMs));
          const history = await gateway.current?.getChatHistory({
            sessionKey,
            limit: 25,
          });

          const traces = extractExecTracesFromHistory(history);
          for (const t of traces) {
            const toolCallId = t.toolCallId;
            if (!toolCallId) continue;
            const state =
              t.status === "error" || t.resultText?.includes("Server Error")
                ? "failed"
                : "completed";
            upsertLocal({
              id: toolCallId,
              externalMessageId: toolCallId,
              fromUser: false,
              role: "tool",
              content: t.command ?? `${t.toolName} (missing command)`,
              state,
              errorMessage: t.resultText,
              createdAt: t.timestamp ?? t.resultTimestamp ?? Date.now(),
            });
          }

          // Fallback: hydrate assistant message for this run if WS didn't deliver.
          if (expectedRunId) {
            const assistantKey = `${expectedRunId}:assistant`;
            const existingIdx = messagesRef.current.findIndex(
              (m) => m.externalMessageId === assistantKey,
            );
            const existing =
              existingIdx !== -1 ? messagesRef.current[existingIdx] : null;

            if (!existing || existing.state !== "completed") {
              type HistoryRec = Record<string, unknown>;
              const historyMessages = pickHistoryMessages(history);
              const match = historyMessages
                .slice()
                .reverse()
                .find((m: HistoryRec) => {
                  const role =
                    (typeof m.role === "string" && m.role) ||
                    (typeof m.author === "string" && m.author) ||
                    "assistant";
                  return role === "assistant" && m.runId === expectedRunId;
                });

              if (match) {
                const h = match as HistoryRec;
                const text =
                  (Array.isArray(h.content)
                    ? (h.content as HistoryRec[])
                        .filter(
                          (p: HistoryRec) =>
                            p && typeof p === "object" && p.type === "text",
                        )
                        .map((p: HistoryRec) =>
                          typeof p.text === "string" ? p.text : "",
                        )
                        .filter((t: string) => t.trim().length > 0)
                        .join("\n")
                    : null) ||
                  pickText(h.content) ||
                  pickText(h.text) ||
                  pickText(h.message) ||
                  pickText(h.reply);

                if (text && String(text).trim().length > 0) {
                  const ts =
                    typeof h.timestamp === "number" ? h.timestamp : Date.now();
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
    },
    [
      sessionKey,
      makeClientMessageId,
      upsertLocal,
      ensureConnected,
      gateway,
      messagesRef,
    ],
  );

  // ------------------------------------------------------------------
  // Queue management
  // ------------------------------------------------------------------
  const enqueueOrSend = useCallback(
    async (content: string) => {
      if (isAgentResponding || sendingRef.current) {
        const clientMessageId = makeClientMessageId();
        sendQueueRef.current.push({ clientMessageId, content });
        setQueuedCount(sendQueueRef.current.length);
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
    },
    [isAgentResponding, makeClientMessageId, upsertLocal, sendDirect],
  );

  // Drain queue when agent finishes.
  useEffect(() => {
    if (isAgentResponding) return;
    if (sendingRef.current) return;
    if (sendQueueRef.current.length === 0) return;

    const next = sendQueueRef.current.shift();
    setQueuedCount(sendQueueRef.current.length);
    if (!next) return;

    sendingRef.current = true;
    void sendDirect(next.content, next.clientMessageId).finally(() => {
      sendingRef.current = false;
    });
  }, [isAgentResponding, sendDirect]);

  // ------------------------------------------------------------------
  // Public handlers
  // ------------------------------------------------------------------
  const handleSend = useCallback(
    async (content: string) => {
      await enqueueOrSend(content);
    },
    [enqueueOrSend],
  );

  const handleRetry = useCallback(
    async (externalMessageId: string | undefined) => {
      if (!externalMessageId) return;
      const failedMessage = messagesRef.current.find(
        (m) => m.externalMessageId === externalMessageId,
      );
      if (!failedMessage) return;
      await sendDirect(failedMessage.content);
    },
    [messagesRef, sendDirect],
  );

  const handleAbort = useCallback(async () => {
    if (!activeRun?.externalRunId) return;
    const clientMessageId = makeClientMessageId();
    try {
      await ensureConnected();
      await gateway.current?.abortChat({
        sessionKey,
        runId: activeRun.externalRunId,
        clientMessageId,
      });
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
    } catch {
      // no-op
    }
  }, [
    activeRun,
    sessionKey,
    makeClientMessageId,
    ensureConnected,
    gateway,
    upsertLocal,
  ]);

  return {
    handleSend,
    handleRetry,
    handleAbort,
    isAgentResponding,
    activeRun,
    queuedCount,
    draft,
    draftKey,
  };
}
