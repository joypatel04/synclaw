"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArchiveRestore,
  Bot,
  ExternalLink,
  GitBranch,
  HeartPulse,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AgentManifestPanel } from "@/components/agents/AgentManifestPanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timestamp } from "@/components/shared/Timestamp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AGENT_SETUP_ADVANCED_ENABLED } from "@/lib/features";
import { cn } from "@/lib/utils";

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

function mapOneClickSetupError(code: string | undefined, message: string) {
  switch (code) {
    case "BRIDGE_UNAVAILABLE":
      return "OpenClaw file bridge is unavailable. Verify OpenClaw connection first.";
    case "BRIDGE_WRITE_FAILED":
      return "Could not write required setup files. Check bridge connectivity and retry.";
    case "TEMPLATE_VALIDATION_FAILED":
      return "Template validation failed after setup. Please retry.";
    case "ROLLBACK_FAILED":
      return "Setup failed and rollback was incomplete. Please contact support with this error.";
    case "DUPLICATE_SESSION_KEY":
      return "An agent with this session key already exists in this workspace.";
    case "AGENT_LIMIT_REACHED":
      return "Agent limit reached for this workspace.";
    default:
      return message;
  }
}

function AgentsContent() {
  const { workspaceId, canAdmin, canManage, canEdit } = useWorkspace();
  const router = useRouter();
  const agents =
    useQuery(api.agents.list, { workspaceId, includeArchived: canAdmin }) ?? [];
  const tasks = useQuery(api.tasks.list, { workspaceId }) ?? [];
  const updateStatus = useMutation(api.agents.updateStatus);
  const createAgentOneClick = useAction(api.agentSetup.createAgentOneClick);
  const updateAgent = useMutation(api.agents.update);
  const toggleArchive = useMutation(api.agents.toggleArchive);

  const [showCreate, setShowCreate] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<Id<"agents"> | null>(null);
  const [archivingAgent, setArchivingAgent] = useState<{
    id: Id<"agents">;
    name: string;
    emoji: string;
    isArchived: boolean;
  } | null>(null);
  const [form, setForm] = useState<AgentFormData>(emptyForm);
  const [showArchived, setShowArchived] = useState(false);
  const [renameChoicePrompt, setRenameChoicePrompt] = useState<{
    currentWorkspaceFolderPath: string;
    newDefaultWorkspaceFolderPath: string;
  } | null>(null);

  const activeAgents = agents.filter((a) => !a.isArchived);
  const archivedAgents = agents.filter((a) => a.isArchived);

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

  const openEdit = (agent: (typeof agents)[number]) => {
    setCreateError(null);
    setForm({
      name: agent.name,
      role: agent.role,
      emoji: agent.emoji,
      sessionKey: agent.sessionKey,
      externalAgentId: agent.externalAgentId ?? "",
    });
    setEditingId(agent._id);
  };

  const openCreateModal = () => {
    setCreateError(null);
    setEditingId(null);
    setForm(emptyForm);
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (creatingAgent) return;
    setCreatingAgent(true);
    setCreateError(null);
    try {
      const nextSessionKey =
        form.sessionKey.trim() ||
        `agent:${form.name.toLowerCase().replace(/\s+/g, "-")}:main`;
      const result = (await createAgentOneClick({
        workspaceId,
        name: form.name.trim(),
        role: form.role.trim(),
        emoji: form.emoji,
        sessionKey: nextSessionKey,
        externalAgentId: form.externalAgentId.trim() || undefined,
        source: "agents_page",
      })) as
        | { ok: true; agentId: string }
        | { ok: false; code?: string; message: string };
      if (!result.ok) {
        setCreateError(mapOneClickSetupError(result.code, result.message));
        return;
      }
      setForm(emptyForm);
      setShowCreate(false);
      router.push(`/chat/${result.agentId}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.name.trim()) return;
    const updatePayload = {
      workspaceId,
      id: editingId,
      name: form.name.trim(),
      role: form.role.trim(),
      emoji: form.emoji,
      sessionKey: form.sessionKey.trim(),
      externalAgentId: form.externalAgentId.trim() || undefined,
    } as const;
    try {
      await updateAgent(updatePayload);
      setEditingId(null);
      setForm(emptyForm);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        const jsonStart = message.indexOf("{");
        const payload = jsonStart >= 0 ? message.slice(jsonStart) : message;
        const parsed = JSON.parse(payload) as {
          code?: string;
          currentWorkspaceFolderPath?: string;
          newDefaultWorkspaceFolderPath?: string;
        };
        if (
          parsed.code === "WORKSPACE_FOLDER_RENAME_CHOICE_REQUIRED" &&
          parsed.currentWorkspaceFolderPath &&
          parsed.newDefaultWorkspaceFolderPath
        ) {
          setRenameChoicePrompt({
            currentWorkspaceFolderPath: parsed.currentWorkspaceFolderPath,
            newDefaultWorkspaceFolderPath: parsed.newDefaultWorkspaceFolderPath,
          });
          return;
        }
      } catch {
        // fall through to generic alert
      }
      window.alert(message);
    }
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
    const agentTasks = tasks.filter((t) => t.assigneeIds.includes(agent._id));
    const effectiveStatus = getEffectiveStatus(agent);
    return (
      <div
        key={agent._id}
        className={cn(
          "relative rounded-xl border border-border-default bg-bg-secondary p-5 transition-smooth hover:border-border-hover",
          isArchived && "opacity-60",
        )}
      >
        <Link
          href={`/agents/${agent._id}`}
          aria-label={`Open ${agent.name} details`}
          className="absolute inset-0 z-0 rounded-xl"
        />
        <div className="relative z-10 pointer-events-none flex items-start justify-between">
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
                  <span className="font-mono">{agent.externalAgentId}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
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
                <Timestamp
                  time={agent.lastPulseAt ?? agent.lastHeartbeat}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border-default bg-bg-primary/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">
                  Model
                </p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {agent.telemetry?.currentModel || "unknown"}
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-primary/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">
                  OpenClaw
                </p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {agent.telemetry?.openclawVersion || "unknown"}
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-primary/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">
                  Total Tokens
                </p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {formatTokens(agent.telemetry?.totalTokensUsed)}
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-primary/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">
                  Last Run
                </p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {formatDuration(agent.telemetry?.lastRunDurationMs)} •{" "}
                  {formatCost(agent.telemetry?.lastRunCost)}
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
      <div className="mb-4 flex flex-col gap-3 border-b border-border-default/65 pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal/35 bg-teal/20">
            <Bot className="h-4 w-4 text-teal" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary">
              Agents
            </h1>
            <p className="text-xs text-text-muted hidden sm:block">
              Manage your AI agents
            </p>
          </div>
        </div>
        {(canEdit || canAdmin) && (
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full sm:w-auto gap-2"
              title="Parent/child relationships from session keys"
            >
              <Link href="/agents/tree">
                <GitBranch className="h-4 w-4" />
                Hierarchy
              </Link>
            </Button>
            {canAdmin ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              <Link href="/agents/new">Use recipe</Link>
            </Button>
            ) : null}
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
            {canAdmin ? (
            <Button
              size="sm"
              className="w-full gap-1.5 bg-accent-orange text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)] hover:bg-accent-orange/90 sm:w-auto"
              onClick={openCreateModal}
            >
              Create & Configure Agent
            </Button>
            ) : null}
          </div>
        )}
      </div>

      {AGENT_SETUP_ADVANCED_ENABLED ? (
        <div className="mb-6">
          <AgentManifestPanel />
        </div>
      ) : null}

      {/* Active agents */}
      <div className="space-y-4">
        {activeAgents.map((agent) => renderAgentCard(agent, false))}

        {activeAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-default bg-bg-secondary/50 py-16">
            <Bot className="h-10 w-10 text-text-dim mb-3" />
            <p className="text-sm text-text-muted">No active agents</p>
            {canAdmin && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                  onClick={openCreateModal}
                >
                  Create & Configure Agent
                </Button>
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
            <span className="text-xs">{showArchived ? "▾" : "▸"}</span>
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
              setCreateError(null);
            }
          }}
        >
          <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[480px] max-h-[calc(100vh-2rem)] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-text-primary">
                {editingId ? "Edit Agent" : "Create & Configure Agent"}
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
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
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

              {!editingId ? (
                <p className="text-[11px] text-text-dim">
                  This will create the agent, apply the canonical setup pack,
                  validate setup, and open chat.
                </p>
              ) : null}
              {createError && !editingId ? (
                <p className="text-xs text-status-blocked">{createError}</p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setEditingId(null);
                    setForm(emptyForm);
                    setCreateError(null);
                  }}
                  className="border-border-default text-text-secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                  disabled={creatingAgent && !editingId}
                >
                  {editingId
                    ? "Save Changes"
                    : creatingAgent
                      ? "Creating & configuring..."
                      : "Create & Configure Agent"}
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

      <Dialog
        open={renameChoicePrompt !== null}
        onOpenChange={(open) => {
          if (!open) setRenameChoicePrompt(null);
        }}
      >
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-text-primary">
              Choose Workspace Folder Mapping
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              Agent name/session key change affects the default workspace
              folder. Choose which path to keep.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs">
            <p className="text-text-muted">
              Current:{" "}
              <span className="font-mono text-text-primary">
                {renameChoicePrompt?.currentWorkspaceFolderPath}
              </span>
            </p>
            <p className="text-text-muted">
              New default:{" "}
              <span className="font-mono text-text-primary">
                {renameChoicePrompt?.newDefaultWorkspaceFolderPath}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border-default text-text-secondary"
              onClick={() => setRenameChoicePrompt(null)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!editingId || !form.name.trim()) return;
                await updateAgent({
                  workspaceId,
                  id: editingId,
                  name: form.name.trim(),
                  role: form.role.trim(),
                  emoji: form.emoji,
                  sessionKey: form.sessionKey.trim(),
                  externalAgentId: form.externalAgentId.trim() || undefined,
                  workspaceFolderPathChoice: "keep_existing",
                });
                setRenameChoicePrompt(null);
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Keep Existing Folder
            </Button>
            <Button
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              onClick={async () => {
                if (!editingId || !form.name.trim()) return;
                await updateAgent({
                  workspaceId,
                  id: editingId,
                  name: form.name.trim(),
                  role: form.role.trim(),
                  emoji: form.emoji,
                  sessionKey: form.sessionKey.trim(),
                  externalAgentId: form.externalAgentId.trim() || undefined,
                  workspaceFolderPathChoice: "use_new_default",
                });
                setRenameChoicePrompt(null);
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Use New Default
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
