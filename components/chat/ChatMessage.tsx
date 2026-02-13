"use client";

import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

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
}

export function ChatMessage({
  message,
  agentEmoji = "🤖",
  agentName = "Agent",
}: ChatMessageProps) {
  const isUser = message.fromUser;
  const state = message.state;
  const errorMessage = message.errorMessage;

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

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm",
          isUser ? "bg-accent-orange/20" : "bg-bg-tertiary",
        )}
      >
        {isUser ? "👤" : agentEmoji}
      </div>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-accent-orange/20 rounded-tr-sm"
            : "bg-bg-tertiary rounded-tl-sm",
        )}
      >
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
