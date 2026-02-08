"use client";

import { cn, getPriorityBgColor } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: "high" | "medium" | "low" | "none";
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (priority === "none") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        getPriorityBgColor(priority),
        className,
      )}
    >
      {priority}
    </span>
  );
}
