"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { DollarSign } from "lucide-react";

interface TaskCostBadgeProps {
  taskId: Id<"tasks">;
  compact?: boolean;
}

export function TaskCostBadge({ taskId, compact = false }: TaskCostBadgeProps) {
  const { workspaceId } = useWorkspace();
  const taskCost = useQuery(api.agents.getTaskCost, { workspaceId, taskId });

  // Don't show badge if no runs logged yet
  if (!taskCost || taskCost.runCount === 0) {
    return null;
  }

  // Show badge even if cost is $0.00 (free models) to indicate runs were tracked
  const isFree = taskCost.totalCost === 0;

  const formattedCost = isFree
    ? "Free"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: taskCost.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
      }).format(taskCost.totalCost);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
        {isFree ? (
          <span className="text-status-active">Free</span>
        ) : (
          <>
            <DollarSign className="h-3 w-3" />
            {formattedCost}
          </>
        )}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 bg-bg-tertiary text-xs text-text-muted">
      {isFree ? (
        <>
          <span className="text-status-active font-medium">Free</span>
          {taskCost.runCount > 1 && (
            <span className="text-[10px] text-text-dim">({taskCost.runCount} runs)</span>
          )}
        </>
      ) : (
        <>
          <DollarSign className="h-3 w-3" />
          <span>{formattedCost}</span>
          {taskCost.runCount > 1 && (
            <span className="text-[10px] text-text-dim">({taskCost.runCount} runs)</span>
          )}
        </>
      )}
    </div>
  );
}
