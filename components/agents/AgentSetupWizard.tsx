"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Timestamp } from "@/components/shared/Timestamp";
import {
  buildGenericAgentBootstrapMessage,
  buildMainAgentBootstrapMessage,
  CANONICAL_SESSION_KEYS,
} from "@/lib/onboardingTemplates";
import { buildAgentManifest } from "@/lib/agentManifest";
import { buildAgentsMd } from "@/lib/agentDocs";
import { buildCronPrompt, buildHeartbeatMd } from "@/lib/agentRecipes";
import {
  buildSutrahaProtocolMd,
  SUTRAHA_PROTOCOL_FILENAME,
} from "@/lib/sutrahaProtocol";
import { getChatDraft, setChatDraft } from "@/lib/chatDraft";
import {
  Check,
  Copy,
  Download,
  FolderOpen,
  Settings2,
  Zap,
} from "lucide-react";

type DirectoryHandle = any;

function supportsDirectoryPicker(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as any).showDirectoryPicker === "function";
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function writeTextFile(dir: DirectoryHandle, filename: string, content: string) {
  const handle = await dir.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function fileExists(dir: DirectoryHandle, filename: string): Promise<boolean> {
  try {
    await dir.getFileHandle(filename, { create: false });
    return true;
  } catch {
    return false;
  }
}

function CopyBlock({
  id,
  title,
  value,
  copiedId,
  onCopy,
  actions,
}: {
  id: string;
  title: string;
  value: string;
  copiedId: string | null;
  onCopy: (id: string, value: string) => Promise<void>;
  actions?: ReactNode;
}) {
  const copied = copiedId === id;
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
            {title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void onCopy(id, value)}
            className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-status-active" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <pre className="mt-3 max-h-[320px] overflow-auto rounded-lg bg-bg-primary border border-border-default p-3 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

export function AgentSetupWizard() {
  const { workspaceId, workspace, canAdmin } = useWorkspace();
  const params = useParams<{ id?: string }>();
  const router = useRouter();

  const agentId = (params?.id ?? "") as any;
  const agent = useQuery(
    api.agents.getById,
    agentId ? { workspaceId, id: agentId } : "skip",
  );
  const agents =
    useQuery(api.agents.list, canAdmin ? { workspaceId, includeArchived: true } : "skip") ??
    [];

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const isMain = agent?.sessionKey === CANONICAL_SESSION_KEYS.main;

  const preparedDraft = useMemo(() => {
    if (!agent) return null;
    return getChatDraft({
      workspaceId: String(workspaceId),
      sessionKey: agent.sessionKey,
    });
  }, [agent, workspaceId]);

  const effectiveBootstrap = useMemo(() => {
    if (!agent) return "";
    if (isMain) {
      return buildMainAgentBootstrapMessage({
        workspaceName: workspace.name,
        workspaceId: String(workspaceId),
      });
    }
    return buildGenericAgentBootstrapMessage({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: agent.name,
      agentRole: agent.role,
      sessionKey: agent.sessionKey,
    });
  }, [agent, isMain, workspace.name, workspaceId]);

  const cronPrompt = useMemo(() => {
    if (!agent) return "";
    return buildCronPrompt({ sessionKey: agent.sessionKey });
  }, [agent]);

  const heartbeatMinutes = useMemo(() => {
    // Default to 60 minutes; recipe wizard already suggests better defaults per recipe.
    return isMain ? 720 : 60;
  }, [isMain]);

  const heartbeatMd = useMemo(() => {
    if (!agent) return "";
    return buildHeartbeatMd({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: agent.name,
      sessionKey: agent.sessionKey,
      agentRole: agent.role,
      recommendedMinutes: heartbeatMinutes,
    });
  }, [agent, workspace.name, workspaceId, heartbeatMinutes]);

  const protocolMd = useMemo(() => {
    return buildSutrahaProtocolMd({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
    });
  }, [workspace.name, workspaceId]);

  const agentsMd = useMemo(() => {
    const active = agents.filter((a: any) => !a.isArchived);
    return buildAgentsMd({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agents: active.map((a: any) => ({
        name: a.name,
        sessionKey: a.sessionKey,
        role: a.role,
        emoji: a.emoji,
        agentId: a._id as string,
      })),
    });
  }, [agents, workspace.name, workspaceId]);

  const manifestJson = useMemo(() => {
    const active = agents.filter((a: any) => !a.isArchived);
    const obj = buildAgentManifest({
      workspaceId: String(workspaceId),
      agents: active.map((a: any) => ({
        name: a.name,
        role: a.role,
        emoji: a.emoji,
        sessionKey: a.sessionKey,
        externalAgentId: a.externalAgentId ?? undefined,
      })),
    });
    return JSON.stringify(obj, null, 2);
  }, [agents, workspaceId]);

  // Folder writer
  const canPickDir = useMemo(() => supportsDirectoryPicker(), []);
  const [dirHandle, setDirHandle] = useState<DirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeOk, setWriteOk] = useState(false);

  const pickFolder = async () => {
    setWriteError(null);
    if (!canPickDir) {
      setWriteError(
        "Directory picker not supported in this browser. Use Chrome/Edge on HTTPS or localhost, or use Download/Copy instead.",
      );
      return;
    }
    try {
      const picker: any = (window as any).showDirectoryPicker;
      const handle = await picker();
      if (!handle) return;
      setDirHandle(handle);
      setDirName(handle.name ?? "selected-folder");
      setWriteOk(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes("abort")) setWriteError(msg);
    }
  };

  const writeFiles = async () => {
    setWriteError(null);
    setWriteOk(false);
    if (!dirHandle) {
      setWriteError("Pick a folder first.");
      return;
    }
    if (!agent) return;
    setWriteBusy(true);
    try {
      const candidates: Array<{ filename: string; content: string; mime?: string }> = [
        { filename: "HEARTBEAT.md", content: heartbeatMd, mime: "text/markdown;charset=utf-8" },
        { filename: SUTRAHA_PROTOCOL_FILENAME, content: protocolMd, mime: "text/markdown;charset=utf-8" },
        { filename: "AGENTS.md", content: agentsMd, mime: "text/markdown;charset=utf-8" },
        { filename: "sutraha.agents.json", content: manifestJson, mime: "application/json;charset=utf-8" },
      ];

      const existing: string[] = [];
      for (const c of candidates) {
        if (await fileExists(dirHandle, c.filename)) existing.push(c.filename);
      }

      if (existing.length > 0 && !overwrite) {
        setWriteError(
          `Refusing to overwrite existing files: ${existing.join(
            ", ",
          )}. Enable "Overwrite existing" to proceed.`,
        );
        return;
      }

      for (const c of candidates) {
        await writeTextFile(dirHandle, c.filename, c.content);
      }

      setWriteOk(true);
      setTimeout(() => setWriteOk(false), 2000);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setWriteBusy(false);
    }
  };

  // Connectivity
  const connected = Boolean(agent?.lastPulseAt && agent.lastPulseAt > 0);

  if (!canAdmin) {
    return (
      <EmptyState
        icon={Settings2}
        title="Agent setup requires owner access"
        description="Ask the workspace owner to configure agent files and heartbeat."
      />
    );
  }

  if (agent === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  if (!agent) {
    return (
      <EmptyState
        icon={Settings2}
        title="Agent not found"
        description="This agent may have been deleted or belongs to a different workspace."
      >
        <Button asChild variant="outline">
          <Link href="/agents">Back to agents</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-orange/15 glow-orange">
          <Zap className="h-5 w-5 text-accent-orange" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Agent setup
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Configure local files + heartbeat, then confirm the agent is actually pulsing.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border-default bg-bg-secondary px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-text-dim">
                Session key
              </p>
              <p className="mt-0.5 font-mono text-xs text-text-primary break-all">
                {agent.sessionKey}
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-secondary px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-text-dim">
                Status
              </p>
              <p className="mt-0.5 text-xs text-text-primary">
                {connected ? (
                  <span className="text-status-active font-medium">Connected</span>
                ) : (
                  <span className="text-text-muted">Waiting for first pulse</span>
                )}
              </p>
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 shrink-0">
          <Link href="/agents">Back</Link>
        </Button>
      </div>

      <div className="space-y-6">
        {/* Step 1: Bootstrap */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            1) Bootstrap prompt
          </p>
          <p className="text-xs text-text-muted">
            Paste this into the agent&apos;s OpenClaw prompt (or send as the first chat message).
          </p>

          <div className="mt-4 space-y-4">
            {preparedDraft && preparedDraft.trim() && preparedDraft.trim() !== effectiveBootstrap.trim() ? (
              <CopyBlock
                id="prime"
                title="Prepared first message (from your previous step)"
                value={preparedDraft}
                copiedId={copiedId}
                onCopy={copy}
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => router.push(`/chat/${agent._id}`)}
                    title="Open chat (uses the prepared draft)"
                  >
                    Open chat
                  </Button>
                }
              />
            ) : null}

            <CopyBlock
              id="bootstrap"
              title="Bootstrap prompt"
              value={effectiveBootstrap}
              copiedId={copiedId}
              onCopy={copy}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    const existing = getChatDraft({
                      workspaceId: String(workspaceId),
                      sessionKey: agent.sessionKey,
                    });
                    if (!existing) {
                      setChatDraft({
                        workspaceId: String(workspaceId),
                        sessionKey: agent.sessionKey,
                        content: effectiveBootstrap,
                      });
                    }
                    router.push(`/chat/${agent._id}`);
                  }}
                  title="Open chat with this prompt prefilled"
                >
                  Open chat
                </Button>
              }
            />
          </div>
        </div>

        {/* Step 2: Heartbeat kit */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            2) Heartbeat kit
          </p>
          <p className="text-xs text-text-muted">
            Keep these files short and stable. Cron runs should use the prompt below so they always use the canonical sessionKey.
          </p>

          <div className="mt-4 space-y-4">
            <CopyBlock
              id="cron"
              title="OpenClaw cron prompt"
              value={cronPrompt}
              copiedId={copiedId}
              onCopy={copy}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() =>
                    downloadText(
                      `cron-prompt.${agent.sessionKey.replace(/[:]/g, "_")}.txt`,
                      cronPrompt,
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              }
            />

            <CopyBlock
              id="heartbeat"
              title="HEARTBEAT.md"
              value={heartbeatMd}
              copiedId={copiedId}
              onCopy={copy}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() =>
                    downloadText(
                      `HEARTBEAT.${agent.sessionKey.replace(/[:]/g, "_")}.md`,
                      heartbeatMd,
                      "text/markdown;charset=utf-8",
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              }
            />

            <CopyBlock
              id="protocol"
              title={SUTRAHA_PROTOCOL_FILENAME}
              value={protocolMd}
              copiedId={copiedId}
              onCopy={copy}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() =>
                    downloadText(
                      `SUTRAHA_PROTOCOL.${String(workspaceId).slice(0, 6)}.md`,
                      protocolMd,
                      "text/markdown;charset=utf-8",
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              }
            />
          </div>
        </div>

        {/* Step 3: Write to folder */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            3) Write files into the agent&apos;s OpenClaw workspace (optional)
          </p>
          <p className="text-xs text-text-muted">
            This writes local files on this machine only. Nothing is uploaded to Sutraha HQ.
          </p>

          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-text-muted">
                Folder:{" "}
                <span className="font-mono text-text-secondary">
                  {dirName ?? "(not selected)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() => void pickFolder()}
                >
                  <FolderOpen className="h-4 w-4" />
                  Pick folder
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
                  onClick={() => void writeFiles()}
                  disabled={!dirHandle || writeBusy}
                >
                  {writeBusy ? "Writing..." : "Write files"}
                </Button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="h-4 w-4 accent-accent-orange"
              />
              Overwrite existing files (AGENTS.md, HEARTBEAT.md, {SUTRAHA_PROTOCOL_FILENAME}, sutraha.agents.json)
            </label>

            {writeOk ? (
              <div className="rounded-lg border border-status-active/40 bg-status-active/10 px-3 py-2 text-xs text-status-active">
                Wrote files successfully.
              </div>
            ) : null}
            {writeError ? (
              <div className="rounded-lg border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-xs text-status-blocked">
                {writeError}
              </div>
            ) : null}

            {!canPickDir ? (
              <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-[11px] text-text-dim">
                Tip: Directory write requires the File System Access API (Chrome/Edge) on HTTPS or localhost. Use Download/Copy if unavailable.
              </div>
            ) : null}

            <div className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-[11px] text-text-dim">
              This will write:
              <span className="ml-1 font-mono text-text-muted">HEARTBEAT.md</span>,{" "}
              <span className="font-mono text-text-muted">{SUTRAHA_PROTOCOL_FILENAME}</span>,{" "}
              <span className="font-mono text-text-muted">AGENTS.md</span>,{" "}
              <span className="font-mono text-text-muted">sutraha.agents.json</span>
            </div>
          </div>
        </div>

        {/* Step 4: Bring online */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            4) Bring online
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <p className="text-xs font-semibold text-text-primary">
                First pulse
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                {agent.lastPulseAt && agent.lastPulseAt > 0 ? (
                  <>
                    Received <Timestamp time={agent.lastPulseAt} className="inline-flex ml-1" />
                  </>
                ) : (
                  "Not yet received"
                )}
              </p>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <p className="text-xs font-semibold text-text-primary">
                Telemetry
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                {agent.telemetry?.currentModel && agent.telemetry.currentModel !== "unknown"
                  ? agent.telemetry.currentModel
                  : "unknown model"}{" "}
                • OC{" "}
                {agent.telemetry?.openclawVersion && agent.telemetry.openclawVersion !== "unknown"
                  ? agent.telemetry.openclawVersion
                  : "unknown"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border-default bg-bg-tertiary p-4">
            <p className="text-xs text-text-muted">
              Once your agent is configured with MCP tools and runs (manual or cron), it should send a pulse. If it never connects:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-text-secondary">
              <li>Check MCP server env vars (CONVEX_URL, SUTRAHA_API_KEY, SUTRAHA_WORKSPACE_ID).</li>
              <li>Confirm OpenClaw is using the same sessionKey shown above.</li>
              <li>Open Settings → OpenClaw and verify gateway URL/token.</li>
            </ul>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/settings/openclaw">OpenClaw settings</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/agents/health">Agent health</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Bonus: export helpers */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            Export helpers (optional)
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-text-primary">AGENTS.md</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() =>
                    downloadText(
                      `AGENTS.${String(workspaceId).slice(0, 6)}.md`,
                      agentsMd,
                      "text/markdown;charset=utf-8",
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
              <Textarea
                readOnly
                value={agentsMd}
                rows={7}
                className="mt-3 bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
              />
            </div>
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-text-primary">
                  sutraha.agents.json
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() =>
                    downloadText(
                      `sutraha.agents.${String(workspaceId).slice(0, 6)}.json`,
                      manifestJson,
                      "application/json;charset=utf-8",
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
              <Textarea
                readOnly
                value={manifestJson}
                rows={7}
                className="mt-3 bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
