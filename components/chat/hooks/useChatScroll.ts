"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useChatScroll(messageCount: number) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Auto-scroll when new messages arrive and user is at the bottom.
  useEffect(() => {
    if (messageCount === 0) return;
    if (atBottomRef.current) scrollToBottom("auto");
  }, [messageCount, scrollToBottom]);

  // Track scroll position; show "jump to bottom" button when scrolled up.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      // Adaptive threshold: 15% of viewport height, capped at 200px.
      const threshold = Math.min(el.clientHeight * 0.15, 200);
      const atBottom = distanceFromBottom <= threshold;
      atBottomRef.current = atBottom;
      setShowScrollDown(!atBottom);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  return { viewportRef, showScrollDown, scrollToBottom, isMobile };
}
