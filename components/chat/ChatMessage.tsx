"use client";

import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { RunDetails } from "./RunDetails";
import { Check, X } from "lucide-react";
import { ToolOutputSheet } from "./ToolOutputSheet";

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
  eventsForSession?: Doc<"chatEvents">[];
}

export function ChatMessage({
  message,
  agentEmoji = "🤖",
  agentName = "Agent",
  eventsForSession = [],
}: ChatMessageProps) {
  const isUser = message.fromUser;
  const state = message.state;
  const errorMessage = message.errorMessage;
  const runId = message.externalRunId;
  const role = message.role;
  const isTool = role === "tool";

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
        <div className="max-w-[85%] rounded-2xl bg-bg-tertiary rounded-tl-sm px-4 py-2.5">
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
        {runId && (
          <RunDetails runId={runId} eventsForSession={eventsForSession} />
        )}
        <Timestamp time={message.createdAt} className="mt-1 block text-right" />
      </div>
    </div>
  );
}
