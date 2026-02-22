"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/convex/_generated/api";
import { AUTOPILOT_ENABLED } from "@/lib/features";

export function AutopilotBanner() {
  const { workspaceId, canManage } = useWorkspace();
  const reminder = useQuery(
    (api as any).autopilot.getReminder,
    AUTOPILOT_ENABLED ? { workspaceId } : "skip",
  );

  if (!AUTOPILOT_ENABLED || !canManage || !reminder?.isStale) return null;

  return (
    <div className="border-b border-status-review/40 bg-status-review/10 px-4 py-2 text-xs text-status-review">
      {reminder.hasCompletedRun
        ? `Autopilot weekly plan is stale (${reminder.daysSinceLastCompletedRun} days old).`
        : "Autopilot has not generated a weekly plan yet."}{" "}
      <Link href="/settings/autopilot" className="underline underline-offset-2">
        Open Autopilot
      </Link>
      .
    </div>
  );
}
