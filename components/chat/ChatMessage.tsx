"use client";

import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
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
  const [showDetails, setShowDetails] = useState(false);

  const runId = message.externalRunId;
  const details = useMemo(() => {
    if (!runId) return [];
    return eventsForSession
      .filter((e) => {
        const payload = e.payload as any;
        const run =
          payload?.runId ??
          payload?.payload?.runId ??
          payload?.payload?.payload?.runId;
        return run === runId;
      })
      .slice()
      .sort((a, b) => a.receivedAt - b.receivedAt);
  }, [eventsForSession, runId]);

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
        {runId && details.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              className="text-[10px] text-text-dim hover:text-text-primary underline"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? "Hide details" : "Show details"}
            </button>
            {showDetails && (
              <div className="mt-2 rounded-lg border border-border-default bg-bg-secondary p-2">
                <div className="mb-1 text-[10px] text-text-dim">
                  Run: {runId}
                </div>
                <div className="space-y-1">
                  {details.map((e) => (
                    <div
                      key={e._id}
                      className="text-[10px] text-text-primary"
                    >
                      <span className="text-text-dim">{e.eventType}</span>
                      <span className="text-text-dim"> · </span>
                      <span className="font-mono break-all">{e.eventId}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <Timestamp time={message.createdAt} className="mt-1 block text-right" />
      </div>
    </div>
  );
}
