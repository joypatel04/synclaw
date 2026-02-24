"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Expand, Minimize2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  statusText?: string;
  initialValue?: string;
  initialValueKey?: string;
  compact?: boolean;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  statusText,
  initialValue,
  initialValueKey,
  compact = false,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const appliedInitialRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!initialValue || !initialValue.trim()) return;
    const key = initialValueKey ?? "__default__";
    if (appliedInitialRef.current === key) return;
    appliedInitialRef.current = key;

    // Only apply when the input is empty to avoid stomping user input.
    setContent((prev) => (prev.trim().length === 0 ? initialValue : prev));
    // Auto-expand for large predefined drafts so users can read/edit comfortably.
    const lineCount = initialValue.split("\n").length;
    if (initialValue.length > 280 || lineCount > 6) {
      setIsExpanded(true);
    }
  }, [initialValue, initialValueKey]);

  useEffect(() => {
    if (content.trim().length === 0) {
      setIsExpanded(false);
    }
  }, [content]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const maxHeight = isExpanded ? 320 : compact ? 152 : 180;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [content, compact, isExpanded]);

  const showExpandToggle =
    isExpanded || content.length > 140 || content.includes("\n");

  const doSend = async () => {
    if (!content.trim() || disabled) return;
    if (sendingRef.current) return;
    sendingRef.current = true;

    const outgoing = content.trim();
    // Clear immediately so long-running sends (streaming/history polling) don't
    // leave the input looking "stuck". Restore on error.
    setContent("");
    setIsExpanded(false);
    setErrorText(null);
    try {
      // Do not block input on the full send lifecycle (streaming/history polling).
      // Parent ChatInterface handles queueing and in-flight status.
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
      // Release local lock immediately so users can type/send next message;
      // ChatInterface will queue if agent is still responding.
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void doSend();
      }}
      className={`
        border-t border-border-default bg-bg-secondary
        p-2.5 sm:p-4
      `}
    >
      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-1.5">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className={`flex-1 bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim focus-visible:ring-accent-orange overflow-y-auto text-sm ${
              isExpanded
                ? "resize-y min-h-[160px] max-h-[50vh]"
                : compact
                  ? "resize-none min-h-[38px] max-h-[152px]"
                  : "resize-none min-h-[40px] max-h-[180px]"
            }`}
          />
          {showExpandToggle ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 text-text-dim hover:text-text-primary"
                onClick={() => setIsExpanded((v) => !v)}
                aria-label={
                  isExpanded ? "Collapse composer" : "Expand composer"
                }
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Expand className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ) : null}
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!content.trim() || disabled}
          className="shrink-0 bg-accent-orange hover:bg-accent-orange/90 text-white h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {errorText && (
        <div className="mt-2 text-xs text-status-blocked">{errorText}</div>
      )}
      {statusText && !errorText && (
        <div className="mt-2 text-xs text-text-dim">{statusText}</div>
      )}
    </form>
  );
}
