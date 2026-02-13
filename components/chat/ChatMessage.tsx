"use client";

import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Check, Copy, X } from "lucide-react";
import { ToolOutputSheet } from "./ToolOutputSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

interface ChatMessageProps {
  message: Doc<"chatMessages"> & {
    state?:
      | "queued"
      | "sending"
      | "streaming"
      | "completed"
      | "failed"
      | "aborted";
    errorMessage?: string;
  };
  agentEmoji?: string;
  agentName?: string;
  userName?: string;
  userImage?: string;
  eventsForSession?: Doc<"chatEvents">[];
}

export function ChatMessage({
  message,
  agentEmoji = "🤖",
  agentName = "Agent",
  userName,
  userImage,
  eventsForSession = [],
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
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // Ignore clipboard failures (permissions, insecure context, etc.)
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
    const toolCallId = message.externalMessageId;
    return (
      <div className={cn("flex gap-3", "flex-row")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm bg-bg-tertiary">
          {agentEmoji}
        </div>
        <div className="w-full min-w-0 max-w-[44rem] rounded-2xl bg-bg-tertiary rounded-tl-sm px-4 py-2.5">
          <p className="text-xs font-medium text-text-muted mb-1">
            {agentName}
          </p>
          <ToolOutputSheet
            toolCallId={toolCallId ?? message._id}
            toolName="exec"
            commandFallback={message.content}
            eventsForSession={eventsForSession}
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
              {errorMessage && (
                <details className="mt-2">
                  <summary className="cursor-pointer select-none text-[11px] text-text-dim hover:text-text-primary underline">
                    Show error
                  </summary>
                  <pre className="mt-2 text-[10px] overflow-x-auto rounded-md bg-bg-tertiary p-2">
                    {errorMessage}
                  </pre>
                </details>
              )}
            </div>
          </ToolOutputSheet>
          <Timestamp time={message.createdAt} className="mt-1 block text-right" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {isUser ? (
        <Avatar size="default" className="shrink-0">
          {userImage ? <AvatarImage src={userImage} alt={userName ?? "You"} /> : null}
          <AvatarFallback className="bg-accent-orange/20 text-text-primary">
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
          "group relative w-full min-w-0 max-w-[44rem] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-accent-orange/20 rounded-tr-sm"
            : "bg-bg-tertiary rounded-tl-sm",
        )}
      >
        {!isUser && plainText.trim().length > 0 && (
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 text-text-muted hover:text-text-primary"
              onClick={handleCopy}
              aria-label="Copy message"
              title={copied ? "Copied" : "Copy"}
            >
              <Copy className="h-3.5 w-3.5" />
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
