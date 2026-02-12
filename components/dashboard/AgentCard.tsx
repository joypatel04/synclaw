"use client";

import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timestamp } from "@/components/shared/Timestamp";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: Doc<"agents">;
  currentTask?: Doc<"tasks"> | null;
}

export function AgentCard({ agent, currentTask }: AgentCardProps) {
  const model = agent.telemetry?.currentModel;
  const openclawVersion = agent.telemetry?.openclawVersion;
  const showTelemetry =
    (model && model !== "unknown") ||
    (openclawVersion && openclawVersion !== "unknown");

  return (
    <div
      className={cn(
        "group rounded-xl border border-border-default bg-bg-secondary p-4 transition-smooth",
        "hover:border-border-hover hover:bg-bg-tertiary",
        agent.status === "active" && "border-l-2 border-l-status-active",
        agent.status === "error" && "border-l-2 border-l-status-blocked",
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AgentAvatar
            emoji={agent.emoji}
            name={agent.name}
            size="md"
            status={agent.status}
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text-primary">
              {agent.name}
            </h3>
            <p className="truncate text-xs text-text-muted">{agent.role}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} className="ml-auto shrink-0" />
      </div>

      {currentTask && agent.status === "active" && (
        <div className="mt-3 w-full min-w-0 rounded-lg bg-bg-primary/50 px-3 py-2">
          <p className="text-xs text-text-muted">Working on</p>
          <p className="mt-0.5 w-full break-words text-xs font-medium text-text-primary">
            {currentTask.title}
          </p>
        </div>
      )}

      {showTelemetry && (
        <p className="mt-3 text-[11px] text-text-muted truncate">
          {model && model !== "unknown" ? model : "unknown model"} • OC{" "}
          {openclawVersion && openclawVersion !== "unknown"
            ? openclawVersion
            : "unknown"}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-text-dim">Heartbeat</span>
        <Timestamp time={agent.lastHeartbeat} />
      </div>
    </div>
  );
}
