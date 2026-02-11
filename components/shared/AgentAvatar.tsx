"use client";

import { cn } from "@/lib/utils";

interface AgentAvatarProps {
  emoji: string;
  name: string;
  size?: "sm" | "md" | "lg";
  status?: "active" | "idle" | "blocked" | "error" | "offline";
  className?: string;
}

const sizeClasses = {
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-lg",
  lg: "h-12 w-12 text-2xl",
};

const statusColors = {
  active: "bg-status-active",
  idle: "bg-status-idle",
  blocked: "bg-status-blocked",
  error: "bg-status-error",
  offline: "bg-status-offline",
};

export function AgentAvatar({
  emoji,
  name,
  size = "md",
  status,
  className,
}: AgentAvatarProps) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-bg-tertiary",
          sizeClasses[size],
        )}
        title={name}
      >
        {emoji}
      </div>
      {status && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-secondary",
            statusColors[status],
          )}
        />
      )}
    </div>
  );
}
