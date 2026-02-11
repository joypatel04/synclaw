"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { DollarSign } from "lucide-react";

export function BurnRateCard() {
  const { workspaceId } = useWorkspace();
  const burnRate = useQuery(api.agents.getDailyBurnRate, { workspaceId });

  if (!burnRate) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
        <div className="h-4 w-24 animate-pulse bg-bg-tertiary rounded" />
      </div>
    );
  }

  const isFree = burnRate.totalCost === 0 && burnRate.runCount > 0;
  const formattedCost = isFree
    ? "Free"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: burnRate.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(burnRate.totalCost);

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-4 hover:border-border-hover transition-smooth">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-orange/20">
            <DollarSign className="h-4 w-4 text-accent-orange" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Today's Burn Rate
            </p>
            <p className={`text-lg font-bold ${isFree ? "text-status-active" : "text-text-primary"}`}>
              {formattedCost}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">
            {burnRate.runCount} run{burnRate.runCount !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-text-dim">
            {burnRate.activeAgentCount} of {burnRate.totalAgentCount} agents
          </p>
        </div>
      </div>
    </div>
  );
}
