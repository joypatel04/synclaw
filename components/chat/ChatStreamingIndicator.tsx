"use client";

import { AgentAvatar } from "@/components/shared/AgentAvatar";

interface ChatStreamingIndicatorProps {
  agentEmoji: string;
  agentName: string;
}

export function ChatStreamingIndicator({
  agentEmoji,
  agentName,
}: ChatStreamingIndicatorProps) {
  return (
    <div className="flex items-end gap-2.5">
      <AgentAvatar emoji={agentEmoji} name={agentName} size="sm" />
      <div className="rounded-2xl rounded-tl-sm border border-border-default bg-bg-primary px-4 py-3">
        <output
          className="flex items-center gap-1"
          aria-label="Agent is typing"
        >
          <span
            className="inline-block h-2 w-2 rounded-full bg-text-muted"
            style={{ animation: "dotPulse 1.4s ease-in-out infinite" }}
          />
          <span
            className="inline-block h-2 w-2 rounded-full bg-text-muted"
            style={{
              animation: "dotPulse 1.4s ease-in-out 0.15s infinite",
            }}
          />
          <span
            className="inline-block h-2 w-2 rounded-full bg-text-muted"
            style={{
              animation: "dotPulse 1.4s ease-in-out 0.3s infinite",
            }}
          />
        </output>
      </div>
    </div>
  );
}
