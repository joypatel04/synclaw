"use client";

import { cn, formatRelativeTime, formatTimestamp } from "@/lib/utils";

interface TimestampProps {
  time: number;
  className?: string;
  showFull?: boolean;
}

export function Timestamp({ time, className, showFull = false }: TimestampProps) {
  if (!Number.isFinite(time) || time <= 0) {
    return (
      <span className={cn("font-mono text-xs text-text-muted", className)}>
        Never
      </span>
    );
  }
  return (
    <time
      className={cn("font-mono text-xs text-text-muted", className)}
      dateTime={new Date(time).toISOString()}
      title={formatTimestamp(time)}
    >
      {showFull ? formatTimestamp(time) : formatRelativeTime(time)}
    </time>
  );
}
