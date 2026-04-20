"use client";

import { useQuery } from "convex/react";
import { Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ActivityItem } from "./ActivityItem";

type ActivityFilter = "all" | "myTasks" | "mentions";

export function ActivityFeed() {
  const { workspaceId } = useWorkspace();
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<Id<"agents"> | null>(
    null,
  );

  useEffect(() => {
    if (agents.length === 0) {
      setSelectedAgentId(null);
      return;
    }
    if (
      !selectedAgentId ||
      !agents.some((agent) => agent._id === selectedAgentId)
    ) {
      setSelectedAgentId(agents[0]._id as Id<"agents">);
    }
  }, [agents, selectedAgentId]);

  const activitiesByAgent = useQuery(api.activities.getByAgent, {
    workspaceId,
    limit: 50,
    ...(filter === "myTasks" && selectedAgentId
      ? { agentId: selectedAgentId }
      : {}),
  });
  const mentionActivities = useQuery(
    api.activities.getWithMention,
    filter === "mentions" && selectedAgentId
      ? {
          workspaceId,
          agentId: selectedAgentId,
          limit: 50,
        }
      : "skip",
  );

  const activities = useMemo(
    () =>
      filter === "mentions"
        ? (mentionActivities ?? [])
        : (activitiesByAgent ?? []),
    [filter, mentionActivities, activitiesByAgent],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Activity className="h-4 w-4 text-text-secondary" />
          Activity
        </h2>
        <span className="text-[10px] text-text-muted font-mono">
          Last 7 days
        </span>
      </div>
      <div className="px-3 pb-2 space-y-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            className="h-7 text-[10px]"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "myTasks" ? "default" : "outline"}
            className="h-7 text-[10px]"
            onClick={() => setFilter("myTasks")}
          >
            My Tasks
          </Button>
          <Button
            size="sm"
            variant={filter === "mentions" ? "default" : "outline"}
            className="h-7 text-[10px]"
            onClick={() => setFilter("mentions")}
          >
            Mentions
          </Button>
        </div>
        {(filter === "myTasks" || filter === "mentions") &&
          agents.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {agents.map((agent) => (
                <button
                  key={agent._id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent._id as Id<"agents">)}
                  className={`rounded-md border px-2 py-1 text-[10px] whitespace-nowrap transition-smooth ${
                    selectedAgentId === agent._id
                      ? "bg-bg-hover border-border-hover text-text-secondary"
                      : "bg-bg-primary border-border-default text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {agent.emoji} {agent.name}
                </button>
              ))}
            </div>
          )}
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-1">
          {activities.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Activity will appear here as agents work on tasks"
            />
          ) : (
            activities.map((a) => <ActivityItem key={a._id} activity={a} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
