"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { HierarchyNode } from "@/convex/agents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timestamp } from "@/components/shared/Timestamp";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, X, Cpu, Clock, Zap, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

interface AgentDetailsPanelProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
}

export function AgentDetailsPanel({
  agentId,
  open,
  onOpenChange,
  workspaceId,
}: AgentDetailsPanelProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const agentDetail = useQuery(api.agents.getAgentDetailForTree, {
    workspaceId: workspaceId as any,
    agentId: agentId as any,
  });

  const activities = useQuery(api.agents.getAgentActivityForTree, {
    workspaceId: workspaceId as any,
    agentId: agentId as any,
    limit: 10,
  });

  const currentTask = useQuery(api.tasks.getById, {
    workspaceId: workspaceId as any,
    id: agentDetail?.currentTaskId as any,
  });

  if (!agentDetail) {
    return null;
  }

  const copySessionKey = () => {
    navigator.clipboard.writeText(agentDetail.sessionKey);
  };

  const formatTokens = (tokens: number | undefined) => {
    if (!tokens) return "N/A";
    return tokens.toLocaleString();
  };

  const formatDuration = (ms: number | undefined) => {
    if (!ms) return "N/A";
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const formatCost = (cost: number | undefined) => {
    if (cost === undefined || cost === null) return "N/A";
    if (cost === 0) return "Free";
    return `$${cost.toFixed(4)}`;
  };

  const content = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border-primary pb-4">
        <div className="flex items-start gap-3">
          <AgentAvatar
            emoji={agentDetail.emoji}
            name={agentDetail.name}
            size="lg"
            status={agentDetail.status}
          />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {agentDetail.name}
            </h2>
            <p className="text-sm text-text-muted">{agentDetail.role}</p>
            <StatusBadge status={agentDetail.status} />
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-6">
          {/* Session Key */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text-muted">
              Session Key
            </label>
            <div className="flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2">
              <code className="flex-1 truncate text-sm text-text-primary">
                {agentDetail.sessionKey}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={copySessionKey}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Telemetry */}
          {agentDetail.telemetry && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-text-muted">
                <Cpu className="h-4 w-4" />
                Telemetry
              </h3>
              <div className="grid gap-3 rounded-lg bg-bg-secondary p-3">
                <div>
                  <p className="text-xs text-text-muted">Model</p>
                  <p className="text-sm font-medium text-text-primary">
                    {agentDetail.telemetry.currentModel || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">OpenClaw Version</p>
                  <p className="text-sm font-medium text-text-primary">
                    {agentDetail.telemetry.openclawVersion || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Total Tokens Used</p>
                  <p className="text-sm font-medium text-text-primary">
                    {formatTokens(agentDetail.telemetry.totalTokensUsed)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Last Run Duration</p>
                  <p className="text-sm font-medium text-text-primary">
                    {formatDuration(agentDetail.telemetry.lastRunDurationMs)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Last Run Cost</p>
                  <p className="text-sm font-medium text-text-primary">
                    {formatCost(agentDetail.telemetry.lastRunCost)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Current Task */}
          {currentTask && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-text-muted">
                <Activity className="h-4 w-4" />
                Current Task
              </h3>
              <div className="rounded-lg bg-bg-secondary p-3">
                <p className="font-medium text-text-primary">
                  {currentTask.title}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Status: <StatusBadge status={currentTask.status as any} />
                </p>
              </div>
            </div>
          )}

          {/* Last Pulse */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-text-muted">
              <Clock className="h-4 w-4" />
              Last Pulse
            </h3>
            <p className="text-sm text-text-primary">
              {agentDetail.lastPulseAt ? (
                <>
                  <Timestamp time={agentDetail.lastPulseAt} /> (
                  {formatDistanceToNow(new Date(agentDetail.lastPulseAt), {
                    addSuffix: true,
                  })}
                  )
                </>
              ) : (
                "Never"
              )}
            </p>
          </div>

          {/* Recent Activity */}
          {activities && activities.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-text-muted">
                <Zap className="h-4 w-4" />
                Recent Activity
              </h3>
              <div className="space-y-2">
                {activities.map((activity) => (
                  <div
                    key={activity._id}
                    className="rounded-lg bg-bg-secondary px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-text-primary">
                        {activity.type}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatDistanceToNow(new Date(activity._creationTime), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Mobile: Dialog, Desktop: Sheet
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-[80vh] max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Agent Details</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px]">
        <SheetHeader className="sr-only">
          <SheetTitle>Agent Details</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
