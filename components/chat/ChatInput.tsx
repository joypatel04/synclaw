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
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  statusText,
  initialValue,
  initialValueKey,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const appliedInitialRef = useRef<string | null>(null);

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

  const showExpandToggle =
    isExpanded || content.length > 140 || content.includes("\n");

  const doSend = async () => {
    if (!content.trim() || isSending) return;
    if (sendingRef.current) return;
    sendingRef.current = true;

    const outgoing = content.trim();
    // Clear immediately so long-running sends (streaming/history polling) don't
    // leave the input looking "stuck". Restore on error.
    setContent("");
    setErrorText(null);
    setIsSending(true);
    try {
      await onSend(outgoing);
    } catch (error) {
      setContent(outgoing);
      const msg =
        error instanceof Error ? error.message : "Failed to send message";
      setErrorText(msg);
    } finally {
      setIsSending(false);
      sendingRef.current = false;
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
      className="p-3 sm:p-4 border-t border-border-default bg-bg-secondary"
    >
      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-1.5">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={isExpanded ? 8 : 1}
            disabled={disabled}
            className={`flex-1 bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim focus-visible:ring-accent-orange overflow-y-auto text-sm ${
              isExpanded
                ? "resize-y min-h-[180px] max-h-[50vh]"
                : "resize-none min-h-[40px] max-h-[180px]"
            }`}
          />
          {showExpandToggle ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-text-dim hover:text-text-primary"
                onClick={() => setIsExpanded((v) => !v)}
              >
                {isExpanded ? (
                  <>
                    <Minimize2 className="mr-1 h-3.5 w-3.5" />
                    Collapse
                  </>
                ) : (
                  <>
                    <Expand className="mr-1 h-3.5 w-3.5" />
                    Expand
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!content.trim() || isSending || disabled}
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
