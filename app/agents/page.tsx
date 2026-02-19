"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timestamp } from "@/components/shared/Timestamp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Archive,
  ArchiveRestore,
  Bot,
  Check,
  Copy,
  Download,
  ExternalLink,
  HeartPulse,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { buildGenericAgentBootstrapMessage } from "@/lib/onboardingTemplates";
import { buildCronPrompt, buildHeartbeatMd } from "@/lib/agentRecipes";
import { buildSutrahaProtocolMd, SUTRAHA_PROTOCOL_FILENAME } from "@/lib/sutrahaProtocol";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentManifestPanel } from "@/components/agents/AgentManifestPanel";

type AgentFormData = {
  name: string;
  role: string;
  emoji: string;
  sessionKey: string;
  externalAgentId: string;
};

const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

const emptyForm: AgentFormData = {
  name: "",
  role: "",
  emoji: "🤖",
  sessionKey: "",
  externalAgentId: "",
};

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AgentsContent() {
  const { workspaceId, workspace, canAdmin, canManage } = useWorkspace();
  const router = useRouter();
  const agents =
    useQuery(api.agents.list, { workspaceId, includeArchived: canAdmin }) ?? [];
  const tasks = useQuery(api.tasks.list, { workspaceId }) ?? [];
  const updateStatus = useMutation(api.agents.updateStatus);
  const createAgent = useMutation(api.agents.create);
  const updateAgent = useMutation(api.agents.update);
  const toggleArchive = useMutation(api.agents.toggleArchive);

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<Id<"agents"> | null>(null);
  const [archivingAgent, setArchivingAgent] = useState<{
    id: Id<"agents">;
    name: string;
    emoji: string;
    isArchived: boolean;
  } | null>(null);
  const [form, setForm] = useState<AgentFormData>(emptyForm);
  const [showArchived, setShowArchived] = useState(false);
  const [copiedBootstrap, setCopiedBootstrap] = useState(false);
  const [copiedCron, setCopiedCron] = useState(false);
  const [copiedHeartbeat, setCopiedHeartbeat] = useState(false);
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [heartbeatMinutes, setHeartbeatMinutes] = useState("60");

  const activeAgents = agents.filter((a) => !a.isArchived);
  const archivedAgents = agents.filter((a) => a.isArchived);

  const effectiveSessionKey = useMemo(() => {
    const raw = form.sessionKey.trim();
    if (raw) return raw;
    const slug =
      form.name.trim().length > 0
        ? form.name.trim().toLowerCase().replace(/\s+/g, "-")
        : "new-agent";
    return `agent:${slug}:main`;
  }, [form.sessionKey, form.name]);

  const bootstrapPrompt = useMemo(() => {
    return buildGenericAgentBootstrapMessage({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: form.name.trim() || "New agent",
      agentRole: form.role.trim() || "Agent",
      sessionKey: effectiveSessionKey,
    });
  }, [workspace.name, workspaceId, form.name, form.role, effectiveSessionKey]);

  const cronPrompt = useMemo(() => {
    return buildCronPrompt({ sessionKey: effectiveSessionKey });
  }, [effectiveSessionKey]);

  const heartbeatMd = useMemo(() => {
    const minutes = Math.max(1, Math.floor(Number(heartbeatMinutes) || 60));
    return buildHeartbeatMd({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: form.name.trim() || "New agent",
      sessionKey: effectiveSessionKey,
      agentRole: form.role.trim() || "Agent",
      recommendedMinutes: minutes,
    });
  }, [workspace.name, workspaceId, form.name, form.role, effectiveSessionKey, heartbeatMinutes]);

  const protocolMd = useMemo(() => {
    return buildSutrahaProtocolMd({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
    });
  }, [workspace.name, workspaceId]);

  const handleStatusChange = async (
    agentId: Id<"agents">,
    status: "idle" | "active" | "error" | "offline",
  ) => {
    await updateStatus({ workspaceId, id: agentId, status });
  };

  const getEffectiveStatus = (
    agent: (typeof agents)[number],
  ): "idle" | "active" | "error" | "offline" => {
    const pulseAt = agent.lastPulseAt ?? 0;
    if (Date.now() - pulseAt > OFFLINE_THRESHOLD_MS) return "offline";
    return agent.status;
  };

  const formatTokens = (tokens: number | undefined) =>
    typeof tokens === "number" ? tokens.toLocaleString("en-US") : "0";

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

  const openCreate = () => {
    setForm(emptyForm);
    setHeartbeatMinutes("60");
    setShowCreate(true);
  };

  const openEdit = (agent: (typeof agents)[number]) => {
    setForm({
      name: agent.name,
      role: agent.role,
      emoji: agent.emoji,
      sessionKey: agent.sessionKey,
      externalAgentId: agent.externalAgentId ?? "",
    });
    setHeartbeatMinutes("60");
    setEditingId(agent._id);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const id = await createAgent({
      workspaceId,
      name: form.name.trim(),
      role: form.role.trim(),
      emoji: form.emoji,
      sessionKey:
        form.sessionKey.trim() ||
        `agent:${form.name.toLowerCase().replace(/\s+/g, "-")}:main`,
      externalAgentId: form.externalAgentId.trim() || undefined,
    });
    setForm(emptyForm);
    setShowCreate(false);
    router.push(`/agents/${id}/setup`);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.name.trim()) return;
    await updateAgent({
      workspaceId,
      id: editingId,
      name: form.name.trim(),
      role: form.role.trim(),
      emoji: form.emoji,
      sessionKey: form.sessionKey.trim(),
      externalAgentId: form.externalAgentId.trim() || undefined,
    });
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleArchiveConfirm = async () => {
    if (!archivingAgent) return;
    await toggleArchive({ workspaceId, id: archivingAgent.id });
    setArchivingAgent(null);
  };

  const renderAgentCard = (
    agent: (typeof agents)[number],
    isArchived: boolean,
  ) => {
    const agentTasks = tasks.filter((t) =>
      t.assigneeIds.includes(agent._id),
    );
    const effectiveStatus = getEffectiveStatus(agent);
    return (
      <div
        key={agent._id}
        className={cn(
          "rounded-xl border border-border-default bg-bg-secondary p-5 transition-smooth hover:border-border-hover",
          isArchived && "opacity-60",
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <AgentAvatar
              emoji={agent.emoji}
              name={agent.name}
              size="lg"
              status={isArchived ? "idle" : effectiveStatus}
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary">
                  {agent.name}
                </h2>
                {isArchived && (
                  <span className="inline-flex items-center rounded-md bg-text-dim/10 px-1.5 py-0.5 text-[10px] font-medium text-text-dim">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted">{agent.role}</p>
              <p className="mt-1 font-mono text-xs text-text-dim">
                {agent.sessionKey}
              </p>
              {agent.externalAgentId && (
                <div className="mt-1 flex items-center gap-1 text-xs text-teal">
                  <ExternalLink className="h-3 w-3" />
                  <span className="font-mono">
                    {agent.externalAgentId}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status dropdown — admin+ can change, but not for archived */}
            {canManage && !isArchived && (
              <Select
                value={effectiveStatus}
                onValueChange={(v) =>
                  handleStatusChange(
                    agent._id,
                    v as "idle" | "active" | "error" | "offline",
                  )
                }
              >
                <SelectTrigger className="w-[120px] bg-bg-primary border-border-default text-text-primary h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Setup wizard — owner only */}
            {canAdmin && !isArchived && (
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href={`/chat/${agent._id}?setup=1`}>Continue setup</Link>
              </Button>
            )}

            {/* Edit — owner only */}
            {canAdmin && !isArchived && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEdit(agent)}
                className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                title="Edit agent"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Archive / Unarchive — owner only */}
            {canAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setArchivingAgent({
                    id: agent._id,
                    name: agent.name,
                    emoji: agent.emoji,
                    isArchived: !!agent.isArchived,
                  })
                }
                className={cn(
                  "h-8 w-8 p-0",
                  isArchived
                    ? "text-teal hover:text-teal hover:bg-teal/10"
                    : "text-text-muted hover:text-status-review hover:bg-status-review/10",
                )}
                title={isArchived ? "Unarchive agent" : "Archive agent"}
              >
                {isArchived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {!isArchived && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-bg-primary/50 px-3 py-2">
                <p className="text-[10px] text-text-dim uppercase tracking-wider">
                  Status
                </p>
                <StatusBadge status={effectiveStatus} className="mt-1" />
              </div>
              <div className="rounded-lg bg-bg-primary/50 px-3 py-2">
                <p className="text-[10px] text-text-dim uppercase tracking-wider">
                  Tasks
                </p>
                <p className="mt-1 text-sm font-medium text-text-primary">
                  {agentTasks.length}
                </p>
              </div>
              <div className="rounded-lg bg-bg-primary/50 px-3 py-2">
                <p className="text-[10px] text-text-dim uppercase tracking-wider">
                  Last Pulse
                </p>
                <Timestamp time={agent.lastPulseAt ?? agent.lastHeartbeat} className="mt-1" />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border-default bg-bg-primary/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">Model</p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {agent.telemetry?.currentModel || "unknown"}
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-primary/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">OpenClaw</p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {agent.telemetry?.openclawVersion || "unknown"}
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-primary/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">Total Tokens</p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {formatTokens(agent.telemetry?.totalTokensUsed)}
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-primary/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">Last Run</p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {formatDuration(agent.telemetry?.lastRunDurationMs)} • {formatCost(agent.telemetry?.lastRunCost)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal/20">
            <Bot className="h-4 w-4 text-teal" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary">Agents</h1>
            <p className="text-xs text-text-muted hidden sm:block">Manage your AI agents</p>
          </div>
        </div>
        {canAdmin && (
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              <Link href="/agents/new">Use recipe</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full sm:w-auto gap-2"
              title="Connectivity and heartbeat freshness"
            >
              <Link href="/agents/health">
                <HeartPulse className="h-4 w-4" />
                Health
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-accent-orange hover:bg-accent-orange/90 text-white gap-1.5 w-full sm:w-auto">
              <Link href="/agents/new">Create agent</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="mb-6">
        <AgentManifestPanel />
      </div>

      {/* Active agents */}
      <div className="space-y-4">
        {activeAgents.map((agent) => renderAgentCard(agent, false))}

        {activeAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-bg-secondary/50 py-16">
            <Bot className="h-10 w-10 text-text-dim mb-3" />
            <p className="text-sm text-text-muted">No active agents</p>
            {canAdmin && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" size="sm">
                  <Link href="/agents/new">Use recipe</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archived section — owner only */}
      {canAdmin && archivedAgents.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text-secondary transition-smooth mb-4"
          >
            <Archive className="h-4 w-4" />
            Archived ({archivedAgents.length})
            <span className="text-xs">
              {showArchived ? "▾" : "▸"}
            </span>
          </button>
          {showArchived && (
            <div className="space-y-3">
              {archivedAgents.map((agent) => renderAgentCard(agent, true))}
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {canAdmin && (
        <Dialog
          open={showCreate || editingId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreate(false);
              setEditingId(null);
              setForm(emptyForm);
              setCopiedBootstrap(false);
              setCopiedCron(false);
              setCopiedHeartbeat(false);
              setCopiedProtocol(false);
              setHeartbeatMinutes("60");
            }
          }}
        >
          <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[480px] max-h-[calc(100vh-2rem)] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-text-primary">
                {editingId ? "Edit Agent" : "Add New Agent"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={editingId ? handleUpdate : handleCreate}
              className="space-y-4"
            >
              <div className="grid grid-cols-[64px_1fr] gap-4">
                <div className="space-y-2">
                  <Label className="text-text-secondary">Emoji</Label>
                  <Input
                    value={form.emoji}
                    onChange={(e) =>
                      setForm({ ...form, emoji: e.target.value })
                    }
                    className="bg-bg-primary border-border-default text-text-primary text-center text-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-text-secondary">Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="e.g., Jarvis"
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-text-secondary">Role</Label>
                <Input
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value })
                  }
                  placeholder="e.g., Squad Lead"
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-text-secondary">Session Key</Label>
                <Input
                  value={form.sessionKey}
                  onChange={(e) =>
                    setForm({ ...form, sessionKey: e.target.value })
                  }
                  placeholder="Auto-generated from name"
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                />
                <p className="text-[11px] text-text-dim">
                  Internal key for agent-to-system communication
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-text-secondary flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  External Agent ID
                </Label>
                <Input
                  value={form.externalAgentId}
                  onChange={(e) =>
                    setForm({ ...form, externalAgentId: e.target.value })
                  }
                  placeholder="e.g., openclaw_agent_abc123"
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
                />
                <p className="text-[11px] text-text-dim">
                  Connect to an external agent platform (OpenClaw, etc.)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-text-secondary">
                    Bootstrap prompt (copy into OpenClaw)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                    onClick={() => {
                      void (async () => {
                        await navigator.clipboard.writeText(bootstrapPrompt);
                        setCopiedBootstrap(true);
                        setTimeout(() => setCopiedBootstrap(false), 1500);
                      })();
                    }}
                    title={copiedBootstrap ? "Copied" : "Copy"}
                  >
                    {copiedBootstrap ? (
                      <Check className="h-4 w-4 text-status-active" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={bootstrapPrompt}
                  rows={8}
                  className="bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
                />
                <p className="text-[11px] text-text-dim">
                  This is a suggested system prompt/instructions for the agent you are creating. Sutraha HQ does not store it; paste it into OpenClaw.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-text-secondary">
                    Heartbeat kit (recommended)
                  </Label>
                </div>
                <p className="text-[11px] text-text-dim">
                  Create a small <span className="font-mono">HEARTBEAT.md</span>{" "}
                  in this agent&apos;s OpenClaw workspace and schedule a cron run
                  using the prompt below.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-text-secondary">
                      Heartbeat cadence (minutes)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={heartbeatMinutes}
                      onChange={(e) => setHeartbeatMinutes(e.target.value)}
                      className="bg-bg-primary border-border-default text-text-primary font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 gap-2"
                      onClick={() =>
                        downloadText(
                          `cron-prompt.${effectiveSessionKey.replace(/[:]/g, "_")}.txt`,
                          cronPrompt,
                        )
                      }
                      title="Download a cron prompt snippet for OpenClaw"
                    >
                      <Download className="h-4 w-4" />
                      Cron
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 gap-2"
                      onClick={() =>
                        downloadText(
                          `HEARTBEAT.${effectiveSessionKey.replace(/[:]/g, "_")}.md`,
                          heartbeatMd,
                        )
                      }
                      title="Download HEARTBEAT.md to place inside the agent's OpenClaw workspace"
                    >
                      <Download className="h-4 w-4" />
                      HEARTBEAT
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                      OpenClaw cron prompt
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                      onClick={() => {
                        void (async () => {
                          await navigator.clipboard.writeText(cronPrompt);
                          setCopiedCron(true);
                          setTimeout(() => setCopiedCron(false), 1500);
                        })();
                      }}
                      title={copiedCron ? "Copied" : "Copy"}
                    >
                      {copiedCron ? (
                        <Check className="h-4 w-4 text-status-active" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Textarea
                    readOnly
                    value={cronPrompt}
                    rows={2}
                    className="bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                      HEARTBEAT.md template
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                      onClick={() => {
                        void (async () => {
                          await navigator.clipboard.writeText(heartbeatMd);
                          setCopiedHeartbeat(true);
                          setTimeout(() => setCopiedHeartbeat(false), 1500);
                        })();
                      }}
                      title={copiedHeartbeat ? "Copied" : "Copy"}
                    >
                      {copiedHeartbeat ? (
                        <Check className="h-4 w-4 text-status-active" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Textarea
                    readOnly
                    value={heartbeatMd}
                    rows={10}
                    className="bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                      {SUTRAHA_PROTOCOL_FILENAME}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2"
                        onClick={() =>
                          downloadText(
                            `SUTRAHA_PROTOCOL.${String(workspaceId).slice(0, 6)}.md`,
                            protocolMd,
                          )
                        }
                        title="Download protocol file (shared rules)"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                        onClick={() => {
                          void (async () => {
                            await navigator.clipboard.writeText(protocolMd);
                            setCopiedProtocol(true);
                            setTimeout(() => setCopiedProtocol(false), 1500);
                          })();
                        }}
                        title={copiedProtocol ? "Copied" : "Copy"}
                      >
                        {copiedProtocol ? (
                          <Check className="h-4 w-4 text-status-active" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    readOnly
                    value={protocolMd}
                    rows={10}
                    className="bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
                  />
                  <p className="text-[11px] text-text-dim">
                    Put the same protocol file in each agent&apos;s OpenClaw workspace to keep prompts short.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setEditingId(null);
                    setForm(emptyForm);
                    setCopiedBootstrap(false);
                    setCopiedCron(false);
                    setCopiedHeartbeat(false);
                    setCopiedProtocol(false);
                    setHeartbeatMinutes("60");
                  }}
                  className="border-border-default text-text-secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                >
                  {editingId ? "Save Changes" : "Add Agent"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Archive / Unarchive Confirmation ── */}
      <Dialog
        open={archivingAgent !== null}
        onOpenChange={(open) => {
          if (!open) setArchivingAgent(null);
        }}
      >
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-text-primary">
              {archivingAgent?.isArchived ? "Unarchive" : "Archive"} Agent
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              {archivingAgent?.isArchived ? (
                <>
                  Restore{" "}
                  <span className="font-semibold text-text-primary">
                    {archivingAgent?.emoji} {archivingAgent?.name}
                  </span>{" "}
                  back to your active agents?
                </>
              ) : (
                <>
                  Archive{" "}
                  <span className="font-semibold text-text-primary">
                    {archivingAgent?.emoji} {archivingAgent?.name}
                  </span>
                  ? The agent will be hidden from the main list but can be
                  restored anytime.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchivingAgent(null)}
              className="border-border-default text-text-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchiveConfirm}
              className={
                archivingAgent?.isArchived
                  ? "bg-teal hover:bg-teal/90 text-white"
                  : "bg-status-review hover:bg-status-review/90 text-white"
              }
            >
              {archivingAgent?.isArchived ? "Unarchive" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <AppLayout>
      <AgentsContent />
    </AppLayout>
  );
}
