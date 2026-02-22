"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bot, RotateCw, Settings, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUTOPILOT_ENABLED, BILLING_ENABLED, WEBHOOKS_ENABLED } from "@/lib/features";

type BusinessStage =
  | "idea"
  | "pre_launch"
  | "onboarding"
  | "early_revenue"
  | "growth";

type RiskTolerance = "low" | "medium" | "high";

const stageOptions: Array<{ value: BusinessStage; label: string }> = [
  { value: "idea", label: "Idea" },
  { value: "pre_launch", label: "Pre-launch" },
  { value: "onboarding", label: "Onboarding" },
  { value: "early_revenue", label: "Early revenue" },
  { value: "growth", label: "Growth" },
];

function SettingsTabs() {
  const base = "border-b-2 px-4 py-2.5 text-sm font-medium transition-smooth";
  const inactive =
    "border-transparent text-text-muted hover:text-text-primary";

  return (
    <div className="flex gap-1 mb-8 border-b border-border-default overflow-x-auto">
      <Link href="/settings" className={`${base} ${inactive}`}>
        General
      </Link>
      <Link href="/settings/members" className={`${base} ${inactive}`}>
        Members
      </Link>
      <Link href="/settings/openclaw" className={`${base} ${inactive}`}>
        OpenClaw
      </Link>
      {AUTOPILOT_ENABLED ? (
        <Link
          href="/settings/autopilot"
          className={`${base} border-accent-orange text-accent-orange`}
        >
          Autopilot
        </Link>
      ) : null}
      {WEBHOOKS_ENABLED ? (
        <Link href="/settings/webhooks" className={`${base} ${inactive}`}>
          Webhooks
        </Link>
      ) : null}
      {BILLING_ENABLED ? (
        <Link href="/settings/billing" className={`${base} ${inactive}`}>
          Billing
        </Link>
      ) : null}
    </div>
  );
}

function AutopilotContent() {
  const { workspaceId, canManage } = useWorkspace();
  const profile = useQuery((api as any).autopilot.getProfile, { workspaceId });
  const reminder = useQuery((api as any).autopilot.getReminder, { workspaceId });
  const runs =
    useQuery((api as any).autopilot.listRuns, { workspaceId, limit: 20 }) ?? [];

  const upsertProfile = useMutation((api as any).autopilot.upsertProfile);
  const runAutopilot = useAction((api as any).autopilot.runAutopilot);
  const reprocessRun = useAction((api as any).autopilot.reprocessRun);

  const [businessStage, setBusinessStage] = useState<BusinessStage>("onboarding");
  const [northStarMetric, setNorthStarMetric] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState("");
  const [constraints, setConstraints] = useState("");
  const [channels, setChannels] = useState("website, linkedin");
  const [targetAudience, setTargetAudience] = useState("");
  const [timeBudgetHoursPerWeek, setTimeBudgetHoursPerWeek] = useState("12");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [runNotes, setRunNotes] = useState("");

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isReprocessingRunId, setIsReprocessingRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setBusinessStage(profile.businessStage);
    setNorthStarMetric(profile.northStarMetric);
    setWeeklyGoal(profile.weeklyGoal);
    setConstraints(profile.constraints.join("\n"));
    setChannels(profile.channels.join(", "));
    setTargetAudience(profile.targetAudience);
    setTimeBudgetHoursPerWeek(String(profile.timeBudgetHoursPerWeek));
    setRiskTolerance(profile.riskTolerance);
  }, [profile]);

  const parsedProfile = useMemo(() => {
    const constraintRows = constraints
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const channelRows = channels
      .split(",")
      .map((line) => line.trim())
      .filter(Boolean);
    const hours = Number(timeBudgetHoursPerWeek);

    return {
      businessStage,
      northStarMetric: northStarMetric.trim(),
      weeklyGoal: weeklyGoal.trim(),
      constraints: constraintRows,
      channels: channelRows,
      targetAudience: targetAudience.trim(),
      timeBudgetHoursPerWeek: Number.isFinite(hours) ? hours : 0,
      riskTolerance,
    };
  }, [
    businessStage,
    northStarMetric,
    weeklyGoal,
    constraints,
    channels,
    targetAudience,
    timeBudgetHoursPerWeek,
    riskTolerance,
  ]);

  const canSave =
    parsedProfile.northStarMetric.length > 0 &&
    parsedProfile.weeklyGoal.length > 0 &&
    parsedProfile.targetAudience.length > 0 &&
    parsedProfile.timeBudgetHoursPerWeek > 0;

  const latestRun = runs[0] ?? null;

  if (!AUTOPILOT_ENABLED) {
    return (
      <div className="mx-auto max-w-2xl p-3 sm:p-6">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
          <h2 className="text-base font-semibold text-text-primary">
            Autopilot coming soon
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Enable <code>NEXT_PUBLIC_AUTOPILOT_ENABLED=true</code> to use this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-3 sm:p-6">
      <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
          <Settings className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Workspace Settings
          </h1>
          <p className="text-xs text-text-muted hidden sm:block">
            Weekly planning autopilot for the main agent
          </p>
        </div>
      </div>

      <SettingsTabs />

      {reminder?.isStale ? (
        <div className="mb-4 rounded-xl border border-status-review/30 bg-status-review/10 p-3 text-sm text-status-review">
          {reminder.hasCompletedRun
            ? `Autopilot plan is stale (${reminder.daysSinceLastCompletedRun} days old). Generate a fresh weekly plan.`
            : "No completed Autopilot run yet. Generate your first weekly plan."}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">Founder Brief</h2>
          <p className="mt-1 text-xs text-text-muted">
            This profile guides backlog generation for the next 7 days.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Business Stage</Label>
              <Select
                value={businessStage}
                onValueChange={(value) => setBusinessStage(value as BusinessStage)}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default text-text-primary">
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Risk Tolerance</Label>
              <Select
                value={riskTolerance}
                onValueChange={(value) => setRiskTolerance(value as RiskTolerance)}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default text-text-primary">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>North-star Metric</Label>
              <Input
                value={northStarMetric}
                onChange={(event) => setNorthStarMetric(event.target.value)}
                placeholder="Onboarding completion rate"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Weekly Goal</Label>
              <Input
                value={weeklyGoal}
                onChange={(event) => setWeeklyGoal(event.target.value)}
                placeholder="Increase activated users from trial"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target Audience</Label>
              <Input
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                placeholder="Solo founders and small operator teams"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time Budget (hours/week)</Label>
              <Input
                type="number"
                min={1}
                value={timeBudgetHoursPerWeek}
                onChange={(event) => setTimeBudgetHoursPerWeek(event.target.value)}
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Channels (comma separated)</Label>
              <Input
                value={channels}
                onChange={(event) => setChannels(event.target.value)}
                placeholder="website, x, linkedin"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Constraints (one per line)</Label>
              <Textarea
                rows={4}
                value={constraints}
                onChange={(event) => setConstraints(event.target.value)}
                placeholder="No paid ads this week\nMax 12 hours team capacity"
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              disabled={!canManage || !canSave || isSavingProfile}
              onClick={async () => {
                setIsSavingProfile(true);
                try {
                  await upsertProfile({
                    workspaceId,
                    profileInput: parsedProfile,
                  });
                } finally {
                  setIsSavingProfile(false);
                }
              }}
            >
              {isSavingProfile ? "Saving..." : "Save Founder Brief"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Generate Weekly Plan</h2>
              <p className="mt-1 text-xs text-text-muted">
                Manual run creates one strategy document and up to five net-new prioritized tasks.
              </p>
            </div>
            <Button
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              disabled={!canManage || !profile || isRunning}
              onClick={async () => {
                setIsRunning(true);
                try {
                  await runAutopilot({
                    workspaceId,
                    notes: runNotes.trim() || undefined,
                  });
                  setRunNotes("");
                } finally {
                  setIsRunning(false);
                }
              }}
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {isRunning ? "Generating..." : "Generate Weekly Plan"}
            </Button>
          </div>

          <div className="mt-3">
            <Label>Optional this-week focus</Label>
            <Textarea
              rows={3}
              value={runNotes}
              onChange={(event) => setRunNotes(event.target.value)}
              placeholder="Focus on improving onboarding completion for new trial users in week 1."
              disabled={!canManage}
            />
          </div>
        </div>

        {latestRun ? (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-text-primary">Last Run Result</h2>
            <p className="mt-1 text-xs text-text-muted">
              {latestRun.status} · {new Date(latestRun.startedAt).toLocaleString()}
            </p>
            <div className="mt-3 rounded-lg border border-border-default bg-bg-primary p-3">
              <p className="text-xs text-text-muted">Weekly Objective</p>
              <p className="text-sm text-text-primary">
                {latestRun.outputSummary?.weeklyObjective ?? "-"}
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border-default bg-bg-primary p-3">
                <p className="text-xs text-text-muted">Created tasks</p>
                <p className="text-sm text-text-primary">{latestRun.createdTaskIds.length}</p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-primary p-3">
                <p className="text-xs text-text-muted">Skipped duplicates</p>
                <p className="text-sm text-text-primary">
                  {latestRun.outputSummary?.skippedCount ?? 0}
                </p>
              </div>
            </div>
            {latestRun.createdDocumentId ? (
              <div className="mt-3">
                <Link
                  href={`/documents?docId=${latestRun.createdDocumentId}`}
                  className="text-sm text-accent-orange hover:underline"
                >
                  Open strategy document
                </Link>
              </div>
            ) : null}
            {latestRun.errorMessage ? (
              <p className="mt-3 text-sm text-status-blocked">{latestRun.errorMessage}</p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">Run History</h2>
          <div className="mt-3 space-y-2">
            {runs.map((run: any) => (
              <div
                key={run._id}
                className="rounded-lg border border-border-default bg-bg-primary p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-muted">
                      {run.status} · profile v{run.profileVersion} · trigger {run.triggerType}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isReprocessingRunId === run._id}
                      onClick={async () => {
                        setIsReprocessingRunId(run._id);
                        try {
                          await reprocessRun({ workspaceId, runId: run._id });
                        } finally {
                          setIsReprocessingRunId(null);
                        }
                      }}
                    >
                      <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                      {isReprocessingRunId === run._id ? "Reprocessing..." : "Reprocess"}
                    </Button>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-text-muted">
                  tasks: {run.createdTaskIds.length} · skipped: {run.outputSummary?.skippedCount ?? 0}
                </div>
              </div>
            ))}
            {runs.length === 0 ? (
              <p className="text-sm text-text-muted">No autopilot runs yet.</p>
            ) : null}
          </div>
        </div>
      </div>

      {!canManage ? (
        <div className="mt-4 rounded-xl border border-border-default bg-bg-secondary p-3 text-xs text-text-muted">
          <Bot className="h-3.5 w-3.5 inline mr-1" />
          Read-only mode. Owner/admin can save founder brief and run autopilot.
        </div>
      ) : null}
    </div>
  );
}

export default function AutopilotSettingsPage() {
  return (
    <AppLayout>
      <AutopilotContent />
    </AppLayout>
  );
}
