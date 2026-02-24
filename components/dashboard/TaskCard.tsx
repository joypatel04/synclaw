"use client";

import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { Timestamp } from "@/components/shared/Timestamp";
import { TaskCostBadge } from "@/components/task/TaskCostBadge";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

interface TaskCardProps {
  task: Doc<"tasks">;
  agents: Doc<"agents">[];
  isDragging?: boolean;
}

function toCardPreview(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function TaskCard({ task, agents, isDragging }: TaskCardProps) {
  const assignees = agents.filter((a) =>
    task.assigneeIds.includes(a._id as Id<"agents">),
  );
  const blockedReason =
    task.status === "blocked"
      ? (task as unknown as { blockedReason?: string }).blockedReason
      : undefined;
  const preview = task.description ? toCardPreview(task.description) : "";

  return (
    <Link href={`/tasks/${task._id}`}>
      <div
        className={cn(
          "group rounded-lg border border-border-default bg-bg-secondary p-3 transition-smooth cursor-pointer",
          "hover:border-border-hover hover:bg-bg-tertiary hover:shadow-md",
          isDragging && "opacity-60 border-dashed border-accent-orange rotate-1",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-text-primary leading-tight line-clamp-2">
            {task.title}
          </h4>
          <PriorityBadge priority={task.priority} />
        </div>

        {preview ? (
          <p className="mt-1.5 line-clamp-4 text-xs leading-relaxed text-text-muted">
            {preview}
          </p>
        ) : null}
        {blockedReason ? (
          <p className="mt-2 line-clamp-1 rounded-md border border-status-blocked/30 bg-status-blocked/10 px-2 py-1 text-[11px] text-status-blocked">
            Blocker: {blockedReason}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {assignees.map((agent) => (
                <AgentAvatar
                  key={agent._id}
                  emoji={agent.emoji}
                  name={agent.name}
                  size="sm"
                />
              ))}
            </div>
            <TaskCostBadge taskId={task._id} compact />
          </div>
          <Timestamp time={task.updatedAt} />
        </div>
      </div>
    </Link>
  );
}
