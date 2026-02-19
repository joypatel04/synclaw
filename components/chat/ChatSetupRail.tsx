"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { SetupStepCard } from "@/components/chat/SetupStepCard";
import {
  buildMainAgentBootstrapMessage,
  buildGenericAgentBootstrapMessage,
} from "@/lib/onboardingTemplates";
import { buildCronPrompt, buildHeartbeatMd } from "@/lib/agentRecipes";
import { buildSutrahaProtocolMd, SUTRAHA_PROTOCOL_FILENAME } from "@/lib/sutrahaProtocol";
import { setChatDraft } from "@/lib/chatDraft";
import { Check, Copy } from "lucide-react";

type ChatSetupRailProps = {
  selectedAgentId?: Id<"agents"> | null;
};

function CopyBlock({
  title,
  where,
  value,
  onConfirm,
  confirmLabel,
  confirmed,
}: {
  title: string;
  where: string;
  value: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmed?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">{title}</p>
          <p className="mt-1 text-[11px] text-text-muted">Where to paste: {where}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onCopy()}
          className="h-8 w-8 p-0"
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? <Check className="h-4 w-4 text-status-active" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <pre className="mt-2 max-h-[180px] overflow-auto rounded-lg border border-border-default bg-bg-primary p-2 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
        {value}
      </pre>
      {onConfirm && confirmLabel ? (
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={onConfirm}
            disabled={confirmed}
          >
            {confirmed ? "Done" : confirmLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ChatSetupRail({ selectedAgentId = null }: ChatSetupRailProps) {
  const { workspaceId, workspace, canAdmin } = useWorkspace();

  const onboarding = useQuery(
    api.onboarding.getStatus,
    canAdmin ? { workspaceId } : "skip",
  );
  const agents = useQuery(
    api.agents.list,
    canAdmin ? { workspaceId, includeArchived: true } : "skip",
  );

  const selectedAgent = useMemo(() => {
    if (!selectedAgentId || !agents) return null;
    return agents.find((a) => String(a._id) === String(selectedAgentId)) ?? null;
  }, [agents, selectedAgentId]);

  const mainAgent = useMemo(() => {
    if (!agents) return null;
    return agents.find((a) => a.sessionKey === "agent:main:main") ?? null;
  }, [agents]);

  const activeAgent = selectedAgent ?? mainAgent ?? null;

  const setupStatus = useQuery(
    api.agentSetup.getStatus,
    canAdmin && activeAgent && onboarding?.isComplete
      ? { workspaceId, agentId: activeAgent._id }
      : "skip",
  );

  const markStep = useMutation(api.agentSetup.markStep);

  const bootstrap = useMemo(() => {
    if (!activeAgent) return "";
    if (activeAgent.sessionKey === "agent:main:main") {
      return buildMainAgentBootstrapMessage({
        workspaceName: workspace.name,
        workspaceId: String(workspaceId),
      });
    }
    return buildGenericAgentBootstrapMessage({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: activeAgent.name,
      agentRole: activeAgent.role,
      sessionKey: activeAgent.sessionKey,
    });
  }, [activeAgent, workspace.name, workspaceId]);

  const cronPrompt = useMemo(() => {
    if (!activeAgent) return "";
    return buildCronPrompt({ sessionKey: activeAgent.sessionKey });
  }, [activeAgent]);

  const heartbeatMd = useMemo(() => {
    if (!activeAgent) return "";
    return buildHeartbeatMd({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: activeAgent.name,
      sessionKey: activeAgent.sessionKey,
      agentRole: activeAgent.role,
      recommendedMinutes: activeAgent.sessionKey === "agent:main:main" ? 720 : 60,
    });
  }, [activeAgent, workspace.name, workspaceId]);

  const protocolMd = useMemo(
    () =>
      buildSutrahaProtocolMd({
        workspaceName: workspace.name,
        workspaceId: String(workspaceId),
      }),
    [workspace.name, workspaceId],
  );

  if (!canAdmin) {
    return null;
  }

  if (onboarding === undefined || agents === undefined) {
    return (
      <aside className="rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </aside>
    );
  }

  const isOnboardingComplete = Boolean(onboarding?.isComplete);

  if (!isOnboardingComplete) {
    return (
      <aside className="space-y-3 rounded-xl border border-border-default bg-bg-secondary p-4">
        <h2 className="text-sm font-semibold text-text-primary">Workspace setup</h2>
        <SetupStepCard
          title="A) OpenClaw connected"
          description="Save and verify gateway config first."
          done={Boolean(onboarding?.openclawConfigured)}
          actionLabel="Open onboarding"
          onAction={() => {
            window.location.href = "/onboarding";
          }}
        />
        <SetupStepCard
          title="B) Main agent exists"
          description="Create canonical agent:main:main."
          done={Boolean(onboarding?.mainAgentId)}
          actionLabel="Open onboarding"
          onAction={() => {
            window.location.href = "/onboarding";
          }}
        />
      </aside>
    );
  }

  if (!activeAgent) {
    return (
      <aside className="space-y-3 rounded-xl border border-border-default bg-bg-secondary p-4">
        <h2 className="text-sm font-semibold text-text-primary">Agent setup</h2>
        <p className="text-xs text-text-muted">Create/select an agent to continue required setup.</p>
        <Button asChild size="sm" className="bg-accent-orange hover:bg-accent-orange/90 text-white">
          <Link href="/agents/new">Create agent (recipe)</Link>
        </Button>
      </aside>
    );
  }

  return (
    <aside className="space-y-3 rounded-xl border border-border-default bg-bg-secondary p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Setup checklist</h2>
        <p className="mt-1 text-xs text-text-muted">
          Agent: <span className="font-mono text-text-secondary">{activeAgent.sessionKey}</span>
        </p>
      </div>

      <SetupStepCard
        title="C) Bootstrap sent"
        description="Prime this agent once before routine runs."
        done={Boolean(setupStatus?.bootstrapPrimed)}
        actionLabel="Mark done"
        onAction={() =>
          void markStep({
            workspaceId,
            agentId: activeAgent._id,
            step: "bootstrapPrimed",
          })
        }
      />

      <SetupStepCard
        title="D) HEARTBEAT.md placed"
        description="Add the heartbeat runbook into agent workspace."
        done={Boolean(setupStatus?.heartbeatConfirmed)}
        actionLabel="Mark done"
        helper="Example path: ~/.openclaw/workspace-<agent>/HEARTBEAT.md"
        onAction={() =>
          void markStep({
            workspaceId,
            agentId: activeAgent._id,
            step: "heartbeatConfirmed",
          })
        }
      />

      <SetupStepCard
        title="E) Cron configured"
        description="Schedule cron to run using the cron prompt."
        done={Boolean(setupStatus?.cronConfirmed)}
        actionLabel="Mark done"
        helper="Success signal: agent pulse appears in Health/Chat within cadence window."
        onAction={() =>
          void markStep({
            workspaceId,
            agentId: activeAgent._id,
            step: "cronConfirmed",
          })
        }
      />

      <SetupStepCard
        title="F) First pulse detected"
        description="This step is automatic after the first runtime pulse."
        done={Boolean(setupStatus?.pulseDetected)}
      />

      <div className="rounded-xl border border-border-default bg-bg-tertiary p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">Status</p>
        <p className="mt-1 text-xs text-text-muted">
          {setupStatus?.isComplete
            ? "Setup complete."
            : "Setup incomplete. Required: bootstrap + heartbeat + cron + pulse."}
        </p>
      </div>

      <CopyBlock
        title="Bootstrap"
        where="OpenClaw agent prompt (or first chat message)."
        value={bootstrap}
        onConfirm={() =>
          void markStep({
            workspaceId,
            agentId: activeAgent._id,
            step: "bootstrapPrimed",
          })
        }
        confirmLabel="Mark bootstrap done"
        confirmed={Boolean(setupStatus?.bootstrapPrimed)}
      />

      <CopyBlock
        title="HEARTBEAT.md"
        where="~/.openclaw/workspace-<agent>/HEARTBEAT.md"
        value={heartbeatMd}
        onConfirm={() =>
          void markStep({
            workspaceId,
            agentId: activeAgent._id,
            step: "heartbeatConfirmed",
          })
        }
        confirmLabel="Mark heartbeat done"
        confirmed={Boolean(setupStatus?.heartbeatConfirmed)}
      />

      <CopyBlock
        title="Cron prompt"
        where="OpenClaw cron job prompt field."
        value={cronPrompt}
        onConfirm={() =>
          void markStep({
            workspaceId,
            agentId: activeAgent._id,
            step: "cronConfirmed",
          })
        }
        confirmLabel="Mark cron done"
        confirmed={Boolean(setupStatus?.cronConfirmed)}
      />

      <details className="rounded-xl border border-border-default bg-bg-tertiary p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-text-dim">
          {SUTRAHA_PROTOCOL_FILENAME}
        </summary>
        <p className="mt-2 text-[11px] text-text-muted">
          Where to paste: copy into each OpenClaw workspace root.
        </p>
        <pre className="mt-2 max-h-[180px] overflow-auto rounded-lg border border-border-default bg-bg-primary p-2 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
          {protocolMd}
        </pre>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => void navigator.clipboard.writeText(protocolMd)}
          >
            Copy protocol
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={Boolean(setupStatus?.protocolConfirmed)}
            onClick={() =>
              void markStep({
                workspaceId,
                agentId: activeAgent._id,
                step: "protocolConfirmed",
              })
            }
          >
            {setupStatus?.protocolConfirmed ? "Done" : "Mark done"}
          </Button>
        </div>
      </details>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => {
            setChatDraft({
              workspaceId: String(workspaceId),
              sessionKey: activeAgent.sessionKey,
              content: bootstrap,
            });
          }}
        >
          Prefill chat with bootstrap
        </Button>
        <Button asChild size="sm" variant="outline" className="h-8">
          <Link href="/agents/health">Open health</Link>
        </Button>
      </div>
    </aside>
  );
}
