"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { UiChatMessage, UpsertPartial } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const richnessScore = (s: string) => {
  const newlines = (s.match(/\n/g) ?? []).length;
  const fences = (s.match(/```/g) ?? []).length;
  return fences * 500 + newlines * 20 + s.length;
};

const preferRicherContent = (a: string, b: string) =>
  richnessScore(b) > richnessScore(a) ? b : a;

const stateRank = (s: UiChatMessage["state"] | undefined) => {
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

const normalizeForDedupe = (s: string) =>
  s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatMessages() {
  const [localMessages, setLocalMessages] = useState<UiChatMessage[]>([]);
  const localMessagesRef = useRef<UiChatMessage[]>([]);
  // Canonical key → array index. Rebuilt on every state update.
  const localIndexRef = useRef<Map<string, number>>(new Map());
  const localSeqRef = useRef(1);
  const pendingAssistantKeyRef = useRef<string | null>(null);

  const syncRef = useCallback((next: UiChatMessage[]) => {
    localMessagesRef.current = next;
  }, []);

  const rebuildIndex = useCallback((next: UiChatMessage[]) => {
    const map = new Map<string, number>();
    for (let i = 0; i < next.length; i++) {
      const m = next[i];
      // Index by externalMessageId (primary), id (fallback), AND externalRunId
      // so all lookup paths hit the same entry.
      const primary = m.externalMessageId ?? m.id;
      map.set(primary, i);
      if (m.externalRunId) {
        map.set(`${m.externalRunId}:assistant`, i);
      }
    }
    localIndexRef.current = map;
  }, []);

  const makeClientMessageId = useCallback(
    () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  const makePendingAssistantKey = useCallback(
    () =>
      `assistant_pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  // ------------------------------------------------------------------
  // Core upsert with simplified dedup and correct ordering
  // ------------------------------------------------------------------
  const upsertLocal = useCallback(
    (partial: UpsertPartial) => {
      setLocalMessages((prev) => {
        const isAssistant = partial.role === "assistant";
        const isInFlightAssistant =
          isAssistant &&
          !partial.externalRunId &&
          (partial.state === "streaming" || partial.state === "sending");

        // ---- Canonical ID resolution ----
        let canonicalKey =
          isAssistant && partial.externalRunId
            ? `${partial.externalRunId}:assistant`
            : partial.externalMessageId;

        // Force in-flight assistant chunks into a single pending slot.
        if (isInFlightAssistant) {
          canonicalKey =
            pendingAssistantKeyRef.current ?? makePendingAssistantKey();
          pendingAssistantKeyRef.current = canonicalKey;
        }

        const key = canonicalKey ?? partial.id;
        if (!key) return prev;

        // ---- Lookup: try canonical key first ----
        let idx = localIndexRef.current.get(key);

        // Adopt the pending assistant slot when runId arrives.
        // The rebuildIndex now indexes by runId too, so the canonical key
        // lookup above should find it — but the pending key is a fallback.
        if (
          idx === undefined &&
          isAssistant &&
          partial.externalRunId &&
          pendingAssistantKeyRef.current
        ) {
          idx = localIndexRef.current.get(pendingAssistantKeyRef.current);
        }

        // Last resort: linear scan by runId (handles rare index misses).
        if (idx === undefined && isAssistant && partial.externalRunId) {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (
              prev[i].role === "assistant" &&
              prev[i].externalRunId === partial.externalRunId
            ) {
              idx = i;
              break;
            }
          }
        }

        const now = Date.now();

        // ---- Insert new message ----
        if (idx === undefined) {
          const nextMsg: UiChatMessage = {
            id: partial.id ?? key,
            fromUser: partial.fromUser,
            role: partial.role,
            content: partial.content ?? "",
            createdAt: partial.createdAt ?? now,
            localSeq: localSeqRef.current++,
            state: partial.state,
            errorMessage: partial.errorMessage,
            externalMessageId: canonicalKey ?? partial.externalMessageId,
            externalRunId: partial.externalRunId,
          };
          const next = [...prev, nextMsg];
          rebuildIndex(next);
          syncRef(next);
          return next;
        }

        // ---- Update existing message ----
        const existing = prev[idx];

        // Content resolution:
        // - During streaming: always take the latest content
        // - Both terminal: prefer richer content
        const bothTerminal =
          stateRank(existing.state) >= 30 && stateRank(partial.state) >= 30;

        let nextContent: string;
        if (partial.append) {
          nextContent = `${existing.content}${partial.content ?? ""}`;
        } else if (
          partial.state === "streaming" ||
          (!bothTerminal && partial.content !== undefined)
        ) {
          nextContent = partial.content ?? existing.content;
        } else if (bothTerminal) {
          nextContent = preferRicherContent(
            existing.content,
            partial.content ?? "",
          );
        } else {
          nextContent = partial.content ?? existing.content;
        }

        const updated: UiChatMessage = {
          ...existing,
          ...partial,
          id: existing.id,
          content: nextContent,
          // Keep original insertion time for stable ordering.
          createdAt: existing.createdAt,
          localSeq: existing.localSeq,
          state:
            stateRank(partial.state) > stateRank(existing.state)
              ? partial.state
              : existing.state,
          // Promote canonical IDs when we learn them.
          externalMessageId:
            canonicalKey ??
            partial.externalMessageId ??
            existing.externalMessageId,
          externalRunId: partial.externalRunId ?? existing.externalRunId,
          errorMessage: partial.errorMessage ?? existing.errorMessage,
        };

        const next = prev.slice();
        next[idx] = updated;
        // Rebuild indexes so all alias keys (pending, runId, canonical) point here.
        rebuildIndex(next);
        syncRef(next);

        // Close the pending slot once assistant finalises.
        if (
          isAssistant &&
          (partial.state === "completed" ||
            partial.state === "failed" ||
            partial.state === "aborted")
        ) {
          pendingAssistantKeyRef.current = null;
        }

        return next;
      });
    },
    [rebuildIndex, syncRef, makePendingAssistantKey],
  );

  // Echo suppression for user messages from history.
  const hasSimilarUserMessage = useCallback((content: string, ts: number) => {
    const windowMs = 60_000;
    const needle = normalizeForDedupe(content);
    return localMessagesRef.current.some(
      (m) =>
        m.role === "user" &&
        m.fromUser &&
        normalizeForDedupe(m.content) === needle &&
        Math.abs((m.createdAt ?? 0) - ts) <= windowMs,
    );
  }, []);

  const resetPendingSlot = useCallback(() => {
    pendingAssistantKeyRef.current = null;
  }, []);

  // Sorted by insertion order (localSeq). localSeq is immutable per message,
  // so ordering is stable even when messages are updated in place.
  const messages = useMemo(
    () =>
      localMessages.slice().sort((a, b) => {
        const seqDiff = (a.localSeq ?? 0) - (b.localSeq ?? 0);
        if (seqDiff !== 0) return seqDiff;
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      }),
    [localMessages],
  );

  return {
    messages,
    messagesRef: localMessagesRef,
    upsertLocal,
    hasSimilarUserMessage,
    makeClientMessageId,
    resetPendingSlot,
  };
}
