"use client";

import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { Timestamp } from "@/components/shared/Timestamp";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

interface TaskCardProps {
  task: Doc<"tasks">;
  agents: Doc<"agents">[];
  isDragging?: boolean;
}

export function TaskCard({ task, agents, isDragging }: TaskCardProps) {
  const assignees = agents.filter((a) =>
    task.assigneeIds.includes(a._id as Id<"agents">),
  );

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

        {task.description && (
          <div className="mt-1.5 text-xs text-text-muted line-clamp-2">
            <MarkdownContent content={task.description} />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
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
          <Timestamp time={task.updatedAt} />
        </div>
      </div>
    </Link>
  );
}
