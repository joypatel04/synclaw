"use client";

import { Check, Copy, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToolOutputSheet } from "./ToolOutputSheet";

// Re-export from canonical location for backward compatibility.
export type { UiChatMessage } from "./types";
import type { UiChatMessage } from "./types";

interface ChatMessageProps {
  message: UiChatMessage;
  agentEmoji?: string;
  agentName?: string;
  userName?: string;
  userImage?: string;
  compact?: boolean;
}

export function ChatMessage({
  message,
  agentEmoji = "🤖",
  agentName = "Agent",
  userName,
  userImage,
  compact = false,
}: ChatMessageProps) {
  const isUser = message.fromUser;
  const state = message.state;
  const errorMessage = message.errorMessage;
  const role = message.role;
  const isTool = role === "tool";
  const [copied, setCopied] = useState(false);

  const plainText = useMemo(() => {
    // Minimal extraction: we store readable text in `content` already.
    // Tool cards are handled separately above.
    return typeof message.content === "string" ? message.content : "";
  }, [message.content]);

  const handleCopy = async () => {
    const text = plainText;
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts / older browsers.
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
      // Intentionally no-op; UI should not crash if clipboard is blocked.
    }
  };

  const statusText =
    state === "queued"
      ? "Queued"
      : state === "sending"
        ? "Sending..."
        : state === "streaming"
          ? "Streaming..."
          : state === "failed"
            ? "Failed"
            : state === "aborted"
              ? "Aborted"
              : null;
  const commandPreview = plainText.split("\n")[0] ?? plainText;
  const bubbleClass = compact
    ? "group relative min-w-0 w-fit max-w-[88%] rounded-2xl px-3 py-2 border shadow-xs"
    : "group relative min-w-0 w-fit max-w-[92%] sm:max-w-[44rem] rounded-2xl px-4 py-2.5 border shadow-xs";

  if (isTool) {
    const ok = state !== "failed";
    const toolCallId = message.externalMessageId ?? message.id;
    const outputText =
      typeof message.errorMessage === "string"
        ? message.errorMessage
        : undefined;
    return (
      <div className={cn("flex gap-3", "flex-row")}>
        <div
          className={cn(
            "shrink-0 items-center justify-center rounded-full text-sm bg-bg-tertiary",
            compact ? "flex h-7 w-7" : "flex h-8 w-8",
          )}
        >
          {agentEmoji}
        </div>
        <div
          className={cn(
            "min-w-0 w-fit rounded-2xl bg-bg-tertiary rounded-tl-sm",
            compact
              ? "max-w-[88%] px-3 py-2"
              : "max-w-[92%] sm:max-w-[44rem] px-4 py-2.5",
          )}
        >
          <p className="text-xs font-medium text-text-muted mb-1">
            {agentName}
          </p>
          <ToolOutputSheet
            toolCallId={toolCallId}
            toolName="exec"
            command={message.content}
            output={outputText}
          >
            <div
              className={cn(
                "rounded-xl border border-border-default bg-bg-secondary",
                compact ? "p-2.5" : "p-3",
              )}
            >
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
                className={cn(
                  "mt-1.5 truncate font-mono text-text-primary",
                  compact ? "text-[11px]" : "text-[12px]",
                )}
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
          <Timestamp
            time={message.createdAt}
            className="mt-1 block text-right"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {isUser ? (
        <Avatar
          size={compact ? "sm" : "default"}
          className={cn("shrink-0", compact ? "h-7 w-7" : undefined)}
        >
          {userImage ? (
            <AvatarImage src={userImage} alt={userName ?? "You"} />
          ) : null}
          <AvatarFallback className="bg-accent-orange/15 text-text-primary border border-accent-orange/25">
            {(userName?.trim()?.[0] ?? "U").toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div
          className={cn(
            "shrink-0 items-center justify-center rounded-full text-sm bg-bg-tertiary",
            compact ? "flex h-7 w-7" : "flex h-8 w-8",
          )}
        >
          {agentEmoji}
        </div>
      )}
      <div
        className={cn(
          bubbleClass,
          isUser
            ? "bg-accent-orange-dim border-accent-orange/25 rounded-tr-sm"
            : "bg-bg-primary border-border-default rounded-tl-sm",
        )}
      >
        {!isUser && plainText.trim().length > 0 && (
          <div className="absolute right-2 top-2 z-10 opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100">
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
        <p className="text-xs font-medium text-text-muted mb-0.5">
          {isUser ? "You" : agentName}
        </p>
        <div className="text-sm text-text-primary leading-relaxed">
          <MarkdownContent content={message.content} />
        </div>
        {statusText && (
          <p className="mt-1 text-[10px] text-text-dim">{statusText}</p>
        )}
        {errorMessage && (
          <p className="mt-1 text-[10px] text-status-blocked">{errorMessage}</p>
        )}
        <Timestamp
          time={message.createdAt}
          className={cn("block text-right", compact ? "mt-0.5" : "mt-1")}
        />
      </div>
    </div>
  );
}
