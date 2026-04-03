"use client";

import { AgentAvatar } from "@/components/shared/AgentAvatar";
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
          "group cursor-pointer rounded-xl border border-border-default/80 bg-[linear-gradient(165deg,var(--cw-bg-secondary),color-mix(in_oklab,var(--cw-bg-tertiary)_78%,transparent))] p-3 transition-smooth",
          "hover:-translate-y-0.5 hover:border-border-hover hover:bg-bg-tertiary hover:shadow-[0_16px_30px_rgba(2,8,28,0.35)]",
          isDragging && "opacity-60 border-dashed border-accent-orange rotate-1",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-2 text-sm font-medium leading-tight text-text-primary">
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

        <div className="mt-3 flex items-center justify-between border-t border-border-default/60 pt-2.5">
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

          </div>
          <Timestamp time={task.updatedAt} />
        </div>
      </div>
    </Link>
  );
}
