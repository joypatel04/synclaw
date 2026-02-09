"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { Timestamp } from "@/components/shared/Timestamp";
import { CommentForm } from "./CommentForm";
import { MessageSquare } from "lucide-react";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CommentThreadProps { taskId: Id<"tasks">; }

export function CommentThread({ taskId }: CommentThreadProps) {
  const { workspaceId } = useWorkspace();
  const messages = useQuery(api.messages.list, { workspaceId, taskId }) ?? [];
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];

  const getAgentEmoji = (agentId: string | null) => {
    if (!agentId) return null;
    return agents.find((a) => a._id === agentId)?.emoji;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default">
        <MessageSquare className="h-4 w-4 text-accent-orange" />
        <h3 className="text-sm font-semibold text-text-primary">Comments ({messages.length})</h3>
      </div>
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No comments yet" description="Start the discussion" />
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg._id} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-sm">{getAgentEmoji(msg.agentId) ?? "👤"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-medium text-text-primary">{msg.authorName}</span><Timestamp time={msg.createdAt} /></div>
                  <div className="mt-1 text-sm text-text-secondary leading-relaxed">
                    <MarkdownContent content={msg.content} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="border-t border-border-default p-4"><CommentForm taskId={taskId} /></div>
    </div>
  );
}
