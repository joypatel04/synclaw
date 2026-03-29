"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { UiChatMessage, UpsertPartial } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeChatText = (s: string) =>
  s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

const normalizeForDedupe = (s: string) =>
  normalizeChatText(s).replace(/\s+/g, " ").trim();

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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatMessages() {
  const [localMessages, setLocalMessages] = useState<UiChatMessage[]>([]);
  const localMessagesRef = useRef<UiChatMessage[]>([]);
  const localIndexRef = useRef<Map<string, number>>(new Map());
  const localSeqRef = useRef(1);
  const pendingAssistantKeyRef = useRef<string | null>(null);

  // Keep ref in sync with state for non-reactive reads.
  const syncRef = useCallback((next: UiChatMessage[]) => {
    localMessagesRef.current = next;
  }, []);

  // Rebuild the canonical-key → index lookup.
  const rebuildIndex = useCallback((next: UiChatMessage[]) => {
    const map = new Map<string, number>();
    for (let i = 0; i < next.length; i++) {
      const key = next[i].externalMessageId ?? next[i].id;
      map.set(key, i);
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
  // Core upsert — single canonical-ID dedup (Bug 1 fix)
  // + always-forward streaming content  (Bug 2 fix)
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

        // ---- Lookup ----
        let idx = localIndexRef.current.get(key);

        // Adopt the pending assistant slot when runId becomes available.
        if (
          idx === undefined &&
          isAssistant &&
          partial.externalRunId &&
          pendingAssistantKeyRef.current
        ) {
          const pendingIdx = localIndexRef.current.get(
            pendingAssistantKeyRef.current,
          );
          if (pendingIdx !== undefined) idx = pendingIdx;
        }

        // Extra safety: match by runId if key didn't hit.
        if (idx === undefined && isAssistant && partial.externalRunId) {
          const byRunId = prev.findIndex(
            (m) =>
              m.role === "assistant" &&
              m.externalRunId === partial.externalRunId,
          );
          if (byRunId !== -1) idx = byRunId;
        }

        const now = Date.now();
        const tailCreatedAt =
          prev.length > 0 ? prev[prev.length - 1].createdAt : 0;

        // ---- Insert new message ----
        if (idx === undefined) {
          const nextMsg: UiChatMessage = {
            id: partial.id ?? key,
            fromUser: partial.fromUser,
            role: partial.role,
            content: partial.content ?? "",
            createdAt: Math.max(partial.createdAt ?? now, tailCreatedAt + 1),
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

        // BUG 2 FIX: During streaming, always take the latest content.
        // Only use preferRicherContent when BOTH are in a terminal state.
        const bothTerminal =
          stateRank(existing.state) >= 30 && stateRank(partial.state) >= 30;

        let nextContent: string;
        if (partial.append) {
          // True incremental delta — append.
          nextContent = `${existing.content}${partial.content ?? ""}`;
        } else if (
          partial.state === "streaming" ||
          (!bothTerminal && partial.content !== undefined)
        ) {
          // Streaming or transitional update — always use the incoming content.
          nextContent = partial.content ?? existing.content;
        } else if (bothTerminal) {
          // Both completed/failed/aborted — prefer richer content.
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
          createdAt: existing.createdAt,
          localSeq: existing.localSeq,
          state:
            stateRank(partial.state) > stateRank(existing.state)
              ? partial.state
              : existing.state,
          externalMessageId:
            canonicalKey ??
            partial.externalMessageId ??
            existing.externalMessageId,
          externalRunId: partial.externalRunId ?? existing.externalRunId,
          errorMessage: partial.errorMessage ?? existing.errorMessage,
        };

        const next = prev.slice();
        next[idx] = updated;
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

  // Check if a user message with similar content already exists (echo suppression).
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

  // Reset pending slot on session key change.
  const resetPendingSlot = useCallback(() => {
    pendingAssistantKeyRef.current = null;
  }, []);

  // Sorted messages for rendering.
  const messages = useMemo(
    () =>
      localMessages
        .slice()
        .sort(
          (a, b) =>
            (a.localSeq ?? 0) - (b.localSeq ?? 0) ||
            (a.createdAt ?? 0) - (b.createdAt ?? 0) ||
            a.id.localeCompare(b.id),
        ),
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
