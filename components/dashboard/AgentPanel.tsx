"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentCard } from "./AgentCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AgentPanel() {
  const { workspaceId } = useWorkspace();
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const tasks = useQuery(api.tasks.list, { workspaceId }) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent-orange" />
          Agents
        </h2>
        <span className="text-[10px] text-text-muted font-mono">
          {agents.filter((a) => a.status === "active").length} active
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-3 px-3 pb-4">
          {agents.length === 0 ? (
            <EmptyState icon={Bot} title="No agents configured" description="Add agents in the Agents page" />
          ) : (
            agents.map((agent) => {
              const currentTask = agent.currentTaskId ? tasks.find((t) => t._id === agent.currentTaskId) : null;
              return <AgentCard key={agent._id} agent={agent} currentTask={currentTask} />;
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
