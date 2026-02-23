"use client";

import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import { cn } from "@/lib/utils";
import { Check, Copy, X } from "lucide-react";
import { ToolOutputSheet } from "./ToolOutputSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

export type UiChatMessage = {
  id: string;
  fromUser: boolean;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: number;
  localSeq?: number;
  state?:
    | "queued"
    | "sending"
    | "streaming"
    | "completed"
    | "failed"
    | "aborted";
  errorMessage?: string;
  externalMessageId?: string;
  externalRunId?: string;
};

interface ChatMessageProps {
  message: UiChatMessage;
  agentEmoji?: string;
  agentName?: string;
  userName?: string;
  userImage?: string;
}

export function ChatMessage({
  message,
  agentEmoji = "🤖",
  agentName = "Agent",
  userName,
  userImage,
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

  if (isTool) {
    const ok = state !== "failed";
    const toolCallId = message.externalMessageId ?? message.id;
    const outputText =
      typeof message.errorMessage === "string"
        ? message.errorMessage
        : undefined;
    return (
      <div className={cn("flex gap-3", "flex-row")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm bg-bg-tertiary">
          {agentEmoji}
        </div>
        <div className="min-w-0 w-fit max-w-[92%] sm:max-w-[44rem] rounded-2xl bg-bg-tertiary rounded-tl-sm px-4 py-2.5">
          <p className="text-xs font-medium text-text-muted mb-1">
            {agentName}
          </p>
          <ToolOutputSheet
            toolCallId={toolCallId}
            toolName="exec"
            command={message.content}
            output={outputText}
          >
            <div className="rounded-xl border border-border-default bg-bg-secondary p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">🧩</span>
                  <span className="font-mono text-sm font-semibold text-text-primary">
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
              <pre className="mt-2 text-[12px] overflow-x-auto rounded-md bg-bg-tertiary p-2 font-mono text-text-primary">
                {message.content}
              </pre>
              <div
                className={cn(
                  "mt-2 text-[11px]",
                  ok ? "text-text-dim" : "text-status-blocked",
                )}
              >
                {ok ? "Completed" : "Failed"}
              </div>
              {outputText && (
                <details className="mt-2">
                  <summary className="cursor-pointer select-none text-[11px] text-text-dim hover:text-text-primary underline">
                    {ok ? "Show output" : "Show error"}
                  </summary>
                  <pre className="mt-2 text-[10px] overflow-x-auto rounded-md bg-bg-tertiary p-2">
                    {outputText}
                  </pre>
                </details>
              )}
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
        <Avatar size="default" className="shrink-0">
          {userImage ? (
            <AvatarImage src={userImage} alt={userName ?? "You"} />
          ) : null}
          <AvatarFallback className="bg-accent-orange/15 text-text-primary border border-accent-orange/25">
            {(userName?.trim()?.[0] ?? "U").toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm bg-bg-tertiary">
          {agentEmoji}
        </div>
      )}
      <div
        className={cn(
          "group relative min-w-0 w-fit max-w-[92%] sm:max-w-[44rem] rounded-2xl px-4 py-2.5 border shadow-xs",
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
        <Timestamp time={message.createdAt} className="mt-1 block text-right" />
      </div>
    </div>
  );
}
