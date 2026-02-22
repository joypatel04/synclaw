"use client";

import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Bot, RefreshCw, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AUTOPILOT_ENABLED } from "@/lib/features";

export function AutopilotCard() {
  const { workspaceId, canManage } = useWorkspace();
  const profile = useQuery(
    (api as any).autopilot.getProfile,
    AUTOPILOT_ENABLED ? { workspaceId } : "skip",
  );
  const reminder = useQuery(
    (api as any).autopilot.getReminder,
    AUTOPILOT_ENABLED ? { workspaceId } : "skip",
  );
  const runs = useQuery(
    (api as any).autopilot.listRuns,
    AUTOPILOT_ENABLED ? { workspaceId, limit: 1 } : "skip",
  );
  const runAutopilot = useAction((api as any).autopilot.runAutopilot);
  const [running, setRunning] = useState(false);

  if (!AUTOPILOT_ENABLED) return null;

  const latest = runs?.[0] ?? null;

  return (
    <div className="mb-4 rounded-xl border border-border-default bg-bg-secondary p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-dim">Autopilot Weekly Plan</p>
          <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Bot className="h-4 w-4 text-accent-orange" />
            {profile ? "Founder brief configured" : "Founder brief missing"}
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            {latest
              ? `Last run: ${new Date(latest.startedAt).toLocaleString()} (${latest.status})`
              : "No runs yet."}
          </p>
          {reminder?.isStale ? (
            <p className="mt-1 text-xs text-status-review">
              Plan is stale. Refresh this week to keep the main agent focused.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/autopilot">Open</Link>
          </Button>
          <Button
            size="sm"
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
            disabled={!canManage || !profile || running}
            onClick={async () => {
              setRunning(true);
              try {
                await runAutopilot({ workspaceId });
              } finally {
                setRunning(false);
              }
            }}
          >
            {running ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Run now
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
