"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ActivityItem } from "./ActivityItem";
import { EmptyState } from "@/components/shared/EmptyState";
import { Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ActivityFeed() {
  const { workspaceId } = useWorkspace();
  const activities = useQuery(api.activities.recent, { workspaceId, limit: 50 }) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent-orange" />
          Activity
        </h2>
        <span className="text-[10px] text-text-muted font-mono">Last 7 days</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-1">
          {activities.length === 0 ? (
            <EmptyState icon={Activity} title="No activity yet" description="Activity will appear here as agents work on tasks" />
          ) : (
            activities.map((a) => <ActivityItem key={a._id} activity={a} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
