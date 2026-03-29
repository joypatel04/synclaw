"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { AgentBadge } from "@/components/agents/tree/AgentBadge";
import { formatDistanceToNow } from "date-fns";
import { AgentDetailsPanel } from "@/components/agents/tree/AgentDetailsPanel";
import type { HierarchyNode } from "@/convex/agents";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspace } from "@/components/providers/workspace-provider";

interface TreeNodeProps {
  node: HierarchyNode;
  agents: HierarchyNode[];
  level: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
}

export function TreeNode({
  node,
  agents,
  level,
  expanded,
  onToggleExpand,
}: TreeNodeProps) {
  const { workspaceId } = useWorkspace();
  const [showDetails, setShowDetails] = useState(false);

  // Find children
  const children = agents.filter((a) => a.parentId === node._id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(node._id);

  const handleClick = () => {
    if (hasChildren) {
      onToggleExpand(node._id);
    }
  };

  const handleAgentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetails(true);
  };

  const formatLastPulse = () => {
    if (!node.lastPulseAt) return "Never";
    return formatDistanceToNow(new Date(node.lastPulseAt), { addSuffix: true });
  };

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-bg-secondary",
          level > 0 && "ml-5",
        )}
        style={{ marginLeft: level > 0 ? `${level * 20}px` : 0 }}
      >
        {/* Expand/Collapse Chevron */}
        {hasChildren ? (
          <button
            onClick={handleClick}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-bg-tertiary"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-text-muted transition-transform",
                isExpanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <div className="h-6 w-6 shrink-0" />
        )}

        {/* Agent Avatar + Info */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleAgentClick}
                className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-bg-tertiary"
              >
                <AgentAvatar emoji={node.emoji} name={node.name} size="sm" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium text-text-primary">
                    {node.name}
                  </span>
                  <AgentBadge status={node.status} />
                </div>
                <div className="shrink-0 text-xs text-text-muted">
                  {formatLastPulse()}
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="space-y-1">
                <p className="text-sm font-medium">{node.name}</p>
                <p className="text-xs text-text-muted">{node.sessionKey}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Render children if expanded */}
      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child._id}
              node={child}
              agents={agents}
              level={level + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}

      {/* Agent Details Panel */}
      <AgentDetailsPanel
        agentId={node._id}
        open={showDetails}
        onOpenChange={setShowDetails}
        workspaceId={workspaceId}
      />
    </>
  );
}
