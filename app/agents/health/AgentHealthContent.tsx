"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Timestamp } from "@/components/shared/Timestamp";
import { formatRelativeTime } from "@/lib/utils";
import { Activity, HeartPulse, Settings2 } from "lucide-react";

const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

function HealthBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "border-status-active/40 bg-status-active/10 text-status-active"
      : tone === "warn"
        ? "border-status-review/40 bg-status-review/10 text-status-review"
        : "border-status-blocked/40 bg-status-blocked/10 text-status-blocked";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

function AgentHealthInner() {
  const { workspaceId, canAdmin, canManage } = useWorkspace();
  const agents =
    useQuery(api.agents.list, canManage ? { workspaceId, includeArchived: true } : "skip") ??
    [];

  const rows = useMemo(() => {
    const now = Date.now();
    return agents
      .filter((a: any) => !a.isArchived)
      .slice()
      .sort((a: any, b: any) => a.sessionKey.localeCompare(b.sessionKey))
      .map((a: any) => {
        const pulseAt = a.lastPulseAt ?? 0;
        const never = !pulseAt || pulseAt <= 0;
        const stale = !never && now - pulseAt > OFFLINE_THRESHOLD_MS;
        const tone: "ok" | "warn" | "bad" = never ? "bad" : stale ? "warn" : "ok";
        const label = never ? "Never connected" : stale ? "Stale pulse" : "Online";
        return {
          agent: a,
          tone,
          label,
          pulseAt,
        };
      });
  }, [agents]);

  const formatDuration = (ms: number | undefined) => {
    if (!ms || ms <= 0) return "0s";
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const formatCost = (cost: number | undefined) => {
    if (cost === undefined || cost === null) return "$0.00";
    if (cost === 0) return "Free";
    return `$${cost.toFixed(4)}`;
  };

  if (!canManage) {
    return (
      <EmptyState
        icon={Settings2}
        title="Agent health requires admin access"
        description="Ask the workspace owner/admin to review agent connectivity."
      />
    );
  }

  return (
      <div className="mx-auto max-w-4xl p-3 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-orange/15">
              <HeartPulse className="h-4 w-4 text-accent-orange" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary">
                Agent health
              </h1>
              <p className="text-xs text-text-muted hidden sm:block">
                Connectivity, heartbeat freshness, and quick setup actions.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/agents">Back to agents</Link>
            </Button>
            {canAdmin ? (
              <Button
                asChild
                size="sm"
                className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
              >
                <Link href="/agents/new">Create agent</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No agents yet"
            description="Create an agent first, then come back here to verify it is pulsing."
          >
            {canAdmin ? (
              <Button asChild className="bg-accent-orange hover:bg-accent-orange/90 text-white">
                <Link href="/agents/new">Create agent</Link>
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {rows.map(({ agent, tone, label, pulseAt }) => {
              const model = agent.telemetry?.currentModel ?? "unknown";
              const oc = agent.telemetry?.openclawVersion ?? "unknown";
              const lastRun = `${formatDuration(agent.telemetry?.lastRunDurationMs)} • ${formatCost(agent.telemetry?.lastRunCost)}`;
              return (
                <div
                  key={agent._id}
                  className="rounded-xl border border-border-default bg-bg-secondary p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <AgentAvatar
                        emoji={agent.emoji}
                        name={agent.name}
                        size="md"
                        status={agent.status}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-text-primary">
                            {agent.name}
                          </p>
                          <HealthBadge label={label} tone={tone} />
                        </div>
                        <p className="text-xs text-text-muted">{agent.role}</p>
                        <p className="mt-1 font-mono text-xs text-text-dim break-all">
                          {agent.sessionKey}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-text-muted">
                          <span>
                            Last pulse:{" "}
                            {pulseAt && pulseAt > 0 ? (
                              <>
                                <Timestamp time={pulseAt} className="inline-flex" />{" "}
                                <span className="text-text-dim">
                                  ({formatRelativeTime(pulseAt)})
                                </span>
                              </>
                            ) : (
                              <span className="text-text-dim">Never</span>
                            )}
                          </span>
                          <span>
                            Model:{" "}
                            <span className="font-mono text-text-dim">
                              {model}
                            </span>{" "}
                            • OC{" "}
                            <span className="font-mono text-text-dim">
                              {oc}
                            </span>
                          </span>
                          <span>
                            Last run:{" "}
                            <span className="font-mono text-text-dim">
                              {lastRun}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <p className="text-[11px] text-text-dim">
                        Tip: If this says "Never connected", the agent hasn't sent its first{" "}
                        <span className="font-mono">synclaw_agent_pulse</span> yet.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}

export function AgentHealthContent() {
  return (
    <AppLayout>
      <AgentHealthInner />
    </AppLayout>
  );
}
