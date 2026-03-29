"use client";

import { useQuery } from "convex/react";
import { Activity, Bot, HeartPulse } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ScopedFilesystemPanel } from "@/components/filesystem";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

function formatDuration(ms: number | undefined) {
  if (!ms || ms <= 0) return "0s";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}


function AgentDetailContent({ agentId }: { agentId: Id<"agents"> }) {
  const { workspaceId, canAdmin, role } = useWorkspace();
  const canEditFiles = role === "owner" || role === "admin";

  const detail = useQuery(api.agents.getAgentDetail, {
    workspaceId,
    id: agentId,
  });

  const activities =
    useQuery(api.activities.getByAgent, {
      workspaceId,
      agentId,
      limit: 15,
    }) ?? [];

  const currentTask = useQuery(
    api.tasks.getById,
    detail?.agent?.currentTaskId
      ? { workspaceId, id: detail.agent.currentTaskId }
      : "skip",
  );

  if (detail === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  if (!detail) {
    return (
      <p className="py-12 text-center text-sm text-text-muted">
        Agent not found.
      </p>
    );
  }

  const { agent, effectiveWorkspaceFolderPath } = detail;
  const pulseAt = agent.lastPulseAt ?? agent.lastHeartbeat ?? 0;
  const pulseAge = Date.now() - pulseAt;
  const freshnessLabel =
    pulseAt <= 0
      ? "Never connected"
      : pulseAge > OFFLINE_THRESHOLD_MS
        ? "Stale"
        : "Live";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-3 sm:p-6">
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <AgentAvatar
              emoji={agent.emoji}
              name={agent.name}
              size="lg"
              status={agent.status}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-text-primary">
                {agent.name}
              </h1>
              <p className="text-sm text-text-muted">{agent.role}</p>
              <p className="mt-1 break-all font-mono text-xs text-text-dim">
                {agent.sessionKey}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    "rounded-md border px-2 py-1",
                    freshnessLabel === "Live"
                      ? "border-status-active/40 bg-status-active/10 text-status-active"
                      : freshnessLabel === "Stale"
                        ? "border-status-review/40 bg-status-review/10 text-status-review"
                        : "border-status-blocked/40 bg-status-blocked/10 text-status-blocked",
                  )}
                >
                  {freshnessLabel}
                </span>
                <span className="text-text-muted">
                  Model: {agent.telemetry?.currentModel ?? "unknown"}
                </span>
                <span className="text-text-muted">
                  OC: {agent.telemetry?.openclawVersion ?? "unknown"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href={`/chat/${agent._id}`}>
                <Bot className="h-3.5 w-3.5" />
                Open Chat
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href="/agents/health">
                <HeartPulse className="h-3.5 w-3.5" />
                Health
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Agent Workspace Files
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              Scoped root:{" "}
              <span className="font-mono">{effectiveWorkspaceFolderPath}</span>
            </p>
            <div className="mt-4">
              <ScopedFilesystemPanel
                workspaceId={workspaceId}
                canAdmin={canAdmin}
                canEditFiles={canEditFiles}
                basePath={effectiveWorkspaceFolderPath}
                rootLabel={effectiveWorkspaceFolderPath}
                showBridgeSetup={false}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Current Task
            </h3>
            {agent.currentTaskId && currentTask ? (
              <div className="mt-2 rounded-lg border border-border-default bg-bg-primary/60 p-3">
                <p className="text-sm font-medium text-text-primary">
                  {currentTask.title}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Status: {currentTask.status}
                </p>
                <Button
                  asChild
                  variant="link"
                  className="mt-1 h-auto p-0 text-xs text-accent-orange"
                >
                  <Link href={`/tasks/${currentTask._id}`}>Open task</Link>
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-muted">
                No active task assigned.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Last Run
            </h3>
            <p className="mt-2 text-xs text-text-primary">
              {formatDuration(agent.telemetry?.lastRunDurationMs)}
            </p>
          </div>

          <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Recent Activity
            </h3>
            <div className="mt-2 space-y-2">
              {activities.slice(0, 8).map((item) => (
                <div
                  key={item._id}
                  className="rounded-md border border-border-default bg-bg-primary/60 p-2 text-xs"
                >
                  <p className="text-text-primary">{item.message}</p>
                  <p className="mt-1 text-text-muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {activities.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Activity className="h-3.5 w-3.5" />
                  No recent activity.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  return (
    <AppLayout>
      {id ? (
        <AgentDetailContent agentId={id as Id<"agents">} />
      ) : (
        <p className="p-6 text-sm text-text-muted">Missing agent id.</p>
      )}
    </AppLayout>
  );
}
