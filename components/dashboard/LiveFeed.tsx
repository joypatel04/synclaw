"use client";

import { useQuery } from "convex/react";
import { Activity, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ActivityItem } from "./ActivityItem";

type CategoryId =
  | "all"
  | "tasks"
  | "docs"
  | "comments"
  | "broadcasts"
  | "mentions";

function isMentionActivity(a: Doc<"activities">): boolean {
  if (a.type === "mention_alert") return true;
  // Back-compat: older logs might only mark mentions on message metadata.
  if (a.type !== "message_sent") return false;
  const ids = (a.metadata as any)?.mentionedAgentIds;
  return Array.isArray(ids) && ids.length > 0;
}

function isStatusNoiseActivity(a: Doc<"activities">): boolean {
  // Remove status chatter from dashboard feed; it creates noise.
  return a.type === "agent_status";
}

const categories: {
  id: CategoryId;
  label: string;
  predicate: (a: Doc<"activities">) => boolean;
}[] = [
  { id: "all", label: "All", predicate: () => true },
  {
    id: "tasks",
    label: "Tasks",
    predicate: (a) => a.type === "task_created" || a.type === "task_updated",
  },
  {
    id: "docs",
    label: "Docs",
    predicate: (a) =>
      a.type === "document_created" || a.type === "document_updated",
  },
  {
    id: "comments",
    label: "Comments",
    predicate: (a) => a.type === "message_sent",
  },
  {
    id: "broadcasts",
    label: "Broadcasts",
    predicate: (a) => a.type === "broadcast_sent",
  },
  { id: "mentions", label: "Mentions", predicate: (a) => isMentionActivity(a) },
];

export function LiveFeed() {
  const { workspaceId } = useWorkspace();
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const activities =
    useQuery(api.activities.recent, { workspaceId, limit: 250 }) ?? [];

  const [category, setCategory] = useState<CategoryId>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<Id<"agents"> | "all">(
    "all",
  );
  const [query, setQuery] = useState("");

  const visibleActivities = useMemo(() => {
    return activities.filter((a) => !isStatusNoiseActivity(a));
  }, [activities]);

  const countsByCategory = useMemo(() => {
    const result: Record<CategoryId, number> = {
      all: visibleActivities.length,
      tasks: 0,
      docs: 0,
      comments: 0,
      broadcasts: 0,
      mentions: 0,
    };
    for (const a of visibleActivities) {
      if (a.type === "task_created" || a.type === "task_updated")
        result.tasks++;
      if (a.type === "document_created" || a.type === "document_updated")
        result.docs++;
      if (a.type === "message_sent") result.comments++;
      if (a.type === "broadcast_sent") result.broadcasts++;
      if (isMentionActivity(a)) result.mentions++;
    }
    return result;
  }, [visibleActivities]);

  const countsByAgent = useMemo(() => {
    const pred =
      categories.find((c) => c.id === category)?.predicate ?? (() => true);
    const counts = new Map<string, number>();
    for (const a of visibleActivities) {
      if (!pred(a)) continue;
      if (!a.agentId) continue;
      const key = String(a.agentId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [visibleActivities, category]);

  const filtered = useMemo(() => {
    const pred =
      categories.find((c) => c.id === category)?.predicate ?? (() => true);
    const q = query.trim().toLowerCase();
    return visibleActivities.filter((a) => {
      if (!pred(a)) return false;
      if (selectedAgentId !== "all" && a.agentId !== selectedAgentId)
        return false;
      if (q && !a.message.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [visibleActivities, category, selectedAgentId, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border-default/70 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-status-active" />
            LIVE FEED
          </h2>
          <span className="text-[10px] text-text-muted font-mono">
            Last 7 days
          </span>
        </div>
      </div>

      <div className="space-y-2 border-b border-border-default/60 px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const isActive = category === c.id;
            const count = countsByCategory[c.id];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-[10px] font-medium transition-smooth inline-flex items-center gap-2",
                  isActive
                    ? "bg-accent-orange/14 border-accent-orange/45 text-accent-orange"
                    : "bg-bg-primary/75 border-border-default text-text-muted hover:border-border-hover hover:text-text-secondary",
                )}
              >
                <span>{c.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                    isActive
                      ? "bg-accent-orange/20 text-accent-orange"
                      : "bg-bg-secondary text-text-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="h-8 w-full rounded-lg border border-border-default bg-bg-primary/85 pl-7 pr-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent-orange/30"
            />
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedAgentId("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] whitespace-nowrap transition-smooth inline-flex items-center gap-2",
              selectedAgentId === "all"
                ? "bg-accent-orange/14 border-accent-orange/45 text-accent-orange"
                : "bg-bg-primary/75 border-border-default text-text-muted hover:border-border-hover hover:text-text-secondary",
            )}
          >
            <span>All Agents</span>
            <span className="rounded-full bg-bg-secondary px-1.5 py-0.5 text-[10px] leading-none text-text-muted">
              {countsByCategory[category]}
            </span>
          </button>
          {agents.map((agent) => {
            const isActive = selectedAgentId === (agent._id as Id<"agents">);
            const count = countsByAgent.get(String(agent._id)) ?? 0;
            return (
              <button
                key={agent._id}
                type="button"
                onClick={() => setSelectedAgentId(agent._id as Id<"agents">)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] whitespace-nowrap transition-smooth inline-flex items-center gap-2",
                  isActive
                    ? "bg-accent-orange/14 border-accent-orange/45 text-accent-orange"
                    : "bg-bg-primary/75 border-border-default text-text-muted hover:border-border-hover hover:text-text-secondary",
                )}
              >
                <span className="text-[11px]">{agent.emoji}</span>
                <span>{agent.name}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                    isActive
                      ? "bg-accent-orange/20 text-accent-orange"
                      : "bg-bg-secondary text-text-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 px-2 py-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Activity will appear here as agents work on tasks"
            />
          ) : (
            filtered.map((a) => <ActivityItem key={a._id} activity={a} />)
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border-default/65 bg-bg-secondary/70 px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-[10px] text-text-muted">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-status-active" />
          LIVE
        </div>
      </div>
    </div>
  );
}
