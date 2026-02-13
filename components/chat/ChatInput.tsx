"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSending) return;

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
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-border-default bg-bg-secondary"
    >
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim focus-visible:ring-accent-orange resize-none min-h-[40px] text-sm"
        />
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
    </form>
  );
}
