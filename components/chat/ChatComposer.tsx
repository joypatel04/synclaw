"use client";

import { ArrowUp, Expand, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  statusText?: string;
  initialValue?: string;
  initialValueKey?: string;
}

export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  statusText,
  initialValue,
  initialValueKey,
}: ChatComposerProps) {
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const appliedInitialRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Apply initial value (draft recovery).
  useEffect(() => {
    if (!initialValue || !initialValue.trim()) return;
    const key = initialValueKey ?? "__default__";
    if (appliedInitialRef.current === key) return;
    appliedInitialRef.current = key;
    setContent((prev) => (prev.trim().length === 0 ? initialValue : prev));
    const lineCount = initialValue.split("\n").length;
    if (initialValue.length > 280 || lineCount > 6) {
      setIsExpanded(true);
    }
  }, [initialValue, initialValueKey]);

  // Collapse when emptied.
  useEffect(() => {
    if (content.trim().length === 0) {
      setIsExpanded(false);
    }
  }, [content]);

  // Auto-resize textarea with smooth transition.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Max heights: expanded gets more room.
    const maxHeight = isExpanded ? 320 : 180;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [content, isExpanded]);

  const showExpandToggle =
    isExpanded || content.length > 140 || content.includes("\n");

  const doSend = async () => {
    if (!content.trim() || disabled) return;
    if (sendingRef.current) return;
    sendingRef.current = true;

    const outgoing = content.trim();
    setContent("");
    setIsExpanded(false);
    setErrorText(null);

    try {
      void Promise.resolve(onSend(outgoing)).catch((error) => {
        setContent(outgoing);
        const msg =
          error instanceof Error ? error.message : "Failed to send message";
        setErrorText(msg);
      });
    } catch (error) {
      setContent(outgoing);
      const msg =
        error instanceof Error ? error.message : "Failed to send message";
      setErrorText(msg);
    } finally {
      queueMicrotask(() => {
        sendingRef.current = false;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void doSend();
    }
  };

  return (
    <div className="border-t border-border-default/70 bg-bg-secondary/85 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {/* Status bar — above input so it doesn't push the input down */}
      {(statusText || errorText) && (
        <div className="px-3 pt-2 sm:px-4">
          {errorText ? (
            <p className="text-xs text-status-blocked">{errorText}</p>
          ) : statusText ? (
            <p className="text-xs text-text-dim">{statusText}</p>
          ) : null}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSend();
        }}
        className="p-2.5 sm:p-4"
      >
        <div className="relative flex items-end gap-2 rounded-2xl border border-border-default/80 bg-bg-primary/70 px-3 py-2 focus-within:border-accent-orange/45 focus-within:ring-2 focus-within:ring-accent-orange/35 transition-shadow">
          <div className="flex-1 flex flex-col gap-1">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={disabled}
              enterKeyHint="send"
              className={cn(
                "w-full resize-none bg-transparent text-sm text-text-primary placeholder:text-text-dim",
                "outline-none border-none focus:ring-0 p-0",
                "overflow-y-auto transition-[height] duration-150 ease-out",
                isExpanded
                  ? "min-h-[160px] max-h-[320px]"
                  : "min-h-[40px] max-h-[180px]",
              )}
            />
            {showExpandToggle && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-5 w-5 text-text-dim hover:text-text-primary"
                  onClick={() => setIsExpanded((v) => !v)}
                  aria-label={
                    isExpanded ? "Collapse composer" : "Expand composer"
                  }
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Expand className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Send button — inside the textarea container */}
          <Button
            type="submit"
            size="icon"
            disabled={!content.trim() || disabled}
            className="h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 disabled:opacity-30"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
