"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { HierarchyNode } from "@/convex/agents";
import { TreeNode } from "@/components/agents/tree/TreeNode";
import { TreeToolbar } from "@/components/agents/tree/TreeToolbar";
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type AgentStatus = "active" | "idle" | "error" | "offline" | "all";

export function AgentTree({ workspaceId }: { workspaceId: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AgentStatus>("all");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const agents = useQuery(api.agents.getHierarchyTree, {
    workspaceId: workspaceId as any,
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Filter agents by status
  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    if (filter === "all") return agents;
    return agents.filter((agent) => agent.status === filter);
  }, [agents, filter]);

  // Get root agents (no parent)
  const rootAgents = useMemo(() => {
    return filteredAgents.filter((agent) => agent.parentId === null);
  }, [filteredAgents]);

  // Handle expand/collapse all
  const handleExpandAll = () => {
    const allIds = new Set(filteredAgents.map((a) => a._id));
    setExpanded(allIds);
  };

  const handleCollapseAll = () => {
    setExpanded(new Set());
  };

  const handleToggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (agents === undefined) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No agents found. Create your first agent to get started.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <TreeToolbar
        onRefresh={() => setLastRefresh(Date.now())}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        filter={filter}
        onFilterChange={setFilter}
        lastRefresh={lastRefresh}
      />

      {/* Tree */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-1">
          {rootAgents.map((agent) => (
            <TreeNode
              key={agent._id}
              node={agent}
              agents={filteredAgents}
              level={0}
              expanded={expanded}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
