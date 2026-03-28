"use client";

import { cn } from "@/lib/utils";

interface AgentBadgeProps {
  status: "active" | "idle" | "error" | "offline";
}

const statusColors = {
  active: "bg-status-active",
  idle: "bg-status-idle",
  error: "bg-status-error",
  offline: "bg-status-offline",
};

const statusLabels = {
  active: "Active",
  idle: "Idle",
  error: "Error",
  offline: "Offline",
};

export function AgentBadge({ status }: AgentBadgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", statusColors[status])} />
      <span className="text-xs text-text-muted">{statusLabels[status]}</span>
    </div>
  );
}
