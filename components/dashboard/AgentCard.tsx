"use client";

import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timestamp } from "@/components/shared/Timestamp";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

interface AgentCardProps {
  agent: Doc<"agents">;
  currentTask?: Doc<"tasks"> | null;
}

export function AgentCard({ agent, currentTask }: AgentCardProps) {
  return (
    <div
      className={cn(
        "group rounded-xl border border-border-default bg-bg-secondary p-4 transition-smooth",
        "hover:border-border-hover hover:bg-bg-tertiary",
        agent.status === "active" && "border-l-2 border-l-status-active",
        agent.status === "blocked" && "border-l-2 border-l-status-blocked",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <AgentAvatar
            emoji={agent.emoji}
            name={agent.name}
            size="md"
            status={agent.status}
          />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {agent.name}
            </h3>
            <p className="text-xs text-text-muted">{agent.role}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      {currentTask && agent.status === "active" && (
        <div className="mt-3 rounded-lg bg-bg-primary/50 px-3 py-2">
          <p className="text-xs text-text-muted">Working on</p>
          <p className="mt-0.5 text-xs font-medium text-text-primary truncate">
            {currentTask.title}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-text-dim">Heartbeat</span>
        <Timestamp time={agent.lastHeartbeat} />
      </div>
    </div>
  );
}
