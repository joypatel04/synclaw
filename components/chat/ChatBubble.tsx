"use client";

import { Check, Copy, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToolOutputSheet } from "./ToolOutputSheet";
import type { UiChatMessage } from "./types";

interface ChatBubbleProps {
  message: UiChatMessage;
  agentEmoji?: string;
  agentName?: string;
  /** If true, this is the first bubble in a group — shows the author label. */
  isGroupStart?: boolean;
}

export function ChatBubble({
  message,
  agentEmoji: _agentEmoji = "🤖",
  agentName = "Agent",
  isGroupStart = false,
}: ChatBubbleProps) {
  const isUser = message.fromUser;
  const state = message.state;
  const errorMessage = message.errorMessage;
  const role = message.role;
  const isTool = role === "tool";
  const isStreaming = state === "streaming";
  const [copied, setCopied] = useState(false);

  const plainText = useMemo(
    () => (typeof message.content === "string" ? message.content : ""),
    [message.content],
  );

  const handleCopy = async () => {
    const text = plainText;
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.top = "0";
        el.style.left = "0";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // Intentionally no-op.
    }
  };

  // Only show status for non-streaming states — the streaming cursor is the indicator.
  const statusText =
    state === "queued"
      ? "Queued"
      : state === "sending"
        ? "Sending..."
        : state === "failed"
          ? "Failed"
          : state === "aborted"
            ? "Aborted"
            : null;

  // ---- Tool card ----
  if (isTool) {
    const ok = state !== "failed";
    const toolCallId = message.externalMessageId ?? message.id;
    const outputText =
      typeof message.errorMessage === "string"
        ? message.errorMessage
        : undefined;
    const commandPreview = plainText.split("\n")[0] ?? plainText;

    return (
      <div className="w-fit max-w-full sm:max-w-176 overflow-hidden">
        {isGroupStart && (
          <p className="mb-1 text-xs font-medium text-text-muted">
            {agentName}
          </p>
        )}
        <ToolOutputSheet
          toolCallId={toolCallId}
          toolName="exec"
          command={message.content}
          output={outputText}
        >
          <div className="cursor-pointer rounded-xl border border-border-default/75 bg-bg-secondary/85 p-2.5 sm:p-3">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-text-muted" aria-hidden>
                  🧩
                </span>
                <span className="font-mono text-xs font-semibold uppercase tracking-wide text-text-primary">
                  exec
                </span>
              </div>
              <div className="flex items-center gap-2">
                {ok ? (
                  <Check className="h-4 w-4 text-status-active" />
                ) : (
                  <X className="h-4 w-4 text-status-blocked" />
                )}
              </div>
            </div>
            <p
              className="mt-1.5 truncate font-mono text-[11px] sm:text-[12px] text-text-primary"
              title={message.content}
            >
              {commandPreview || "(missing command)"}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-[11px]",
                  ok ? "text-text-dim" : "text-status-blocked",
                )}
              >
                {ok ? "Completed" : "Failed"}
              </span>
              <span className="text-[11px] text-text-muted underline">
                Tap for details
              </span>
            </div>
          </div>
        </ToolOutputSheet>
        <Timestamp time={message.createdAt} className="mt-1 block text-right" />
      </div>
    );
  }

  // ---- User / assistant bubble ----
  return (
    <div
      className={cn(
        "group relative w-fit max-w-full overflow-hidden rounded-2xl border px-3.5 py-2.5 shadow-[0_10px_24px_rgba(2,8,24,0.14)] wrap-break-word sm:max-w-176 sm:px-4 sm:py-3",
        isUser
          ? "rounded-tr-sm border-border-hover bg-bg-secondary/92"
          : "rounded-tl-sm border-border-default/75 bg-bg-primary/86",
      )}
    >
      {/* Copy button — hidden on mobile, hover-reveal on desktop */}
      {!isUser && plainText.trim().length > 0 && (
        <div className="absolute right-2 top-2 z-10 hidden opacity-0 transition-opacity group-hover:opacity-100 sm:block">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 border border-border-default bg-bg-secondary/70 text-text-muted hover:text-text-primary hover:bg-bg-secondary"
            onClick={handleCopy}
            aria-label="Copy message"
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-status-active" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      {isGroupStart && (
        <p className="text-xs font-medium text-text-muted mb-0.5">
          {isUser ? "You" : agentName}
        </p>
      )}

      <div
        className={cn(
          "text-sm text-text-primary leading-relaxed",
          isStreaming && "streaming-cursor",
        )}
      >
        <MarkdownContent content={message.content} />
      </div>

      {statusText && (
        <p className="mt-1 text-[10px] text-text-dim">{statusText}</p>
      )}
      {errorMessage && (
        <p className="mt-1 text-[10px] text-status-blocked">{errorMessage}</p>
      )}
      <Timestamp time={message.createdAt} className="mt-0.5 block text-right" />
    </div>
  );
}
