"use client";

import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import type { Doc } from "@/convex/_generated/dataModel";
import { MessageSquare, Radio, Users } from "lucide-react";
import Link from "next/link";

interface BroadcastCardProps {
  broadcast: Doc<"broadcasts">;
}

export function BroadcastCard({ broadcast }: BroadcastCardProps) {
  return (
    <Link href={`/broadcasts/${broadcast._id}`}>
      <div className="group rounded-xl border border-border-default bg-bg-secondary p-4 transition-smooth hover:border-border-hover hover:bg-bg-tertiary">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-review/20">
              <Radio className="h-4 w-4 text-status-review" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {broadcast.title}
              </h3>
              <p className="text-xs text-text-muted">
                by {broadcast.createdBy}
              </p>
            </div>
          </div>
          <Timestamp time={broadcast.createdAt} />
        </div>

        <div className="mt-3 text-xs text-text-secondary line-clamp-2 leading-relaxed">
          <MarkdownContent content={broadcast.content} />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium">
              {broadcast.targetAgentIds === "all"
                ? "All Agents"
                : `${(broadcast.targetAgentIds as string[]).length} agent(s)`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-text-muted">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium">
              {broadcast.responses.length} responses
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
