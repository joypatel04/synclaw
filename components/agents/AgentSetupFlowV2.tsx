"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, FileCheck2, MessageSquare, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ScopedFilesystemPanel } from "@/components/filesystem";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  REQUIRED_AGENT_SETUP_FILES,
  type RequiredAgentSetupFile,
} from "@/lib/agentSetupTemplates";
import {
  buildGenericAgentBootstrapMessage,
  buildMainAgentBootstrapMessage,
} from "@/lib/onboardingTemplates";
import { setChatDraft } from "@/lib/chatDraft";

type FileScan = {
  exists: boolean;
  changed: boolean;
  hash?: string;
  error?: string;
};

type OperationMode = "keep_existing" | "create" | "replace" | "skip";

export function AgentSetupFlowV2({ agentId }: { agentId: Id<"agents"> }) {
  const router = useRouter();
  const { workspaceId, workspace, canAdmin, role } = useWorkspace();
  const canEditFiles = role === "owner" || role === "admin";
  const detail = useQuery(api.agents.getAgentDetail, {
    workspaceId,
    id: agentId,
  });
  const setupPlan = useQuery(api.agentSetup.getSetupPlan, {
    workspaceId,
    agentId,
  });
  const status = useQuery(api.agentSetup.getStatus, {
    workspaceId,
    agentId,
  });

  const markStep = useMutation(api.agentSetup.markStep);
  const confirmFile = useMutation(api.agentSetup.confirmFile);
  const validateSetup = useAction(api.agentSetup.validateSetup);
  const applySetupFiles = useAction(api.agentSetup.applySetupFiles);
  const readFile = useAction(api.openclaw_files.readFile);
  const writeFile = useAction(api.openclaw_files.writeFile);

  const [mode, setMode] = useState<"guided" | "chat" | "manual">("guided");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scan, setScan] = useState<
    Partial<Record<RequiredAgentSetupFile, FileScan>>
  >({});
  const [ops, setOps] = useState<
    Partial<Record<RequiredAgentSetupFile, OperationMode>>
  >({});
  const [drafts, setDrafts] = useState<
    Partial<Record<RequiredAgentSetupFile, string>>
  >({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [chatPasted, setChatPasted] = useState<
    Partial<Record<RequiredAgentSetupFile, string>>
  >({});

  useEffect(() => {
    if (!setupPlan) return;
    const next: Partial<Record<RequiredAgentSetupFile, string>> = {};
    for (const file of REQUIRED_AGENT_SETUP_FILES) {
      next[file] = (setupPlan.files as Record<string, string>)[file] ?? "";
    }
    setDrafts(next);
  }, [setupPlan]);

  const bootstrap = useMemo(() => {
    if (!detail?.agent) return "";
    if (detail.agent.sessionKey === "agent:main:main") {
      return buildMainAgentBootstrapMessage({
        workspaceName: workspace.name,
        workspaceId: String(workspaceId),
      });
    }
    return buildGenericAgentBootstrapMessage({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: detail.agent.name,
      agentRole: detail.agent.role,
      sessionKey: detail.agent.sessionKey,
    });
  }, [detail?.agent, workspace.name, workspaceId]);

  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const scanWorkspace = async () => {
    if (!detail?.effectiveWorkspaceFolderPath) return;
    setBusy(true);
    setError(null);
    try {
      const nextScan: Partial<Record<RequiredAgentSetupFile, FileScan>> = {};
      const nextOps: Partial<Record<RequiredAgentSetupFile, OperationMode>> =
        {};
      for (const file of REQUIRED_AGENT_SETUP_FILES) {
        try {
          const res = (await readFile({
            workspaceId,
            basePath: detail.effectiveWorkspaceFolderPath,
            path: file,
          })) as {
            content?: string;
            hash?: string;
          };
          const draft = drafts[file] ?? "";
          const changed = (res.content ?? "").trim() !== draft.trim();
          nextScan[file] = {
            exists: true,
            changed,
            hash: res.hash,
          };
          nextOps[file] = changed ? "keep_existing" : "skip";
        } catch (e) {
          nextScan[file] = {
            exists: false,
            changed: false,
            error: e instanceof Error ? e.message : String(e),
          };
          nextOps[file] = "create";
        }
      }
      setScan(nextScan);
      setOps((prev) => ({ ...nextOps, ...prev }));
      setSuccess("Workspace scan completed");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runValidation = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = (await validateSetup({
        workspaceId,
        agentId,
      })) as { ok: boolean; errors: string[] };
      setValidationErrors(result.errors ?? []);
      setSuccess(result.ok ? "Validation passed" : "Validation found blockers");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const applySelected = async () => {
    setBusy(true);
    setError(null);
    try {
      const operations = REQUIRED_AGENT_SETUP_FILES.map((file) => {
        const mode = ops[file] ?? "skip";
        if (mode === "keep_existing" || mode === "skip") {
          return {
            filename: file,
            mode: "skip" as const,
            source: "template" as const,
          };
        }
        return {
          filename: file,
          mode: mode === "replace" ? ("replace" as const) : ("create" as const),
          content: drafts[file] ?? "",
          source: "template" as const,
        };
      });
      await applySetupFiles({
        workspaceId,
        agentId,
        operations,
      });
      await scanWorkspace();
      await runValidation();
      setSuccess("Selected files applied");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const applyChatFile = async (file: RequiredAgentSetupFile) => {
    if (!detail?.effectiveWorkspaceFolderPath) return;
    const content = (chatPasted[file] ?? "").trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await writeFile({
        workspaceId,
        basePath: detail.effectiveWorkspaceFolderPath,
        path: file,
        content,
      })) as { hash?: string };
      await confirmFile({
        workspaceId,
        agentId,
        filename: file,
        hash: res.hash,
        source: "chat",
      });
      setSuccess(`Saved ${file} from chat output`);
      await scanWorkspace();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const replaceFileWithTemplate = async (file: RequiredAgentSetupFile) => {
    if (!detail?.effectiveWorkspaceFolderPath) return;
    const content = drafts[file] ?? "";
    setBusy(true);
    setError(null);
    try {
      const res = (await writeFile({
        workspaceId,
        basePath: detail.effectiveWorkspaceFolderPath,
        path: file,
        content,
      })) as { hash?: string };
      await confirmFile({
        workspaceId,
        agentId,
        filename: file,
        hash: res.hash,
        source: "manual",
      });
      setSuccess(`Replaced ${file} with template`);
      await scanWorkspace();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!canAdmin) {
    return (
      <EmptyState
        icon={Wrench}
        title="Agent setup requires owner access"
        description="Ask the workspace owner to configure this agent."
      />
    );
  }

  if (!detail || !setupPlan || !status) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
      <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
        <h1 className="text-lg font-semibold text-text-primary">
          Agent Setup Guide
        </h1>
        <p className="mt-1 text-xs text-text-muted">
          Strict 8-file setup for reliable Synclaw backend coordination.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["guided", "chat", "manual"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={mode === item ? "default" : "outline"}
              className={mode === item ? "bg-accent-orange text-white" : ""}
              onClick={() => setMode(item)}
            >
              {item === "guided"
                ? "Guided"
                : item === "chat"
                  ? "Chat-driven"
                  : "Manual"}
            </Button>
          ))}
          <Button variant="outline" size="sm" asChild>
            <Link href="/help/agent-setup">Open Setup Guide</Link>
          </Button>
        </div>
      </div>

      {mode === "guided" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void scanWorkspace()}
                disabled={busy}
              >
                Scan workspace files
              </Button>
              <Button
                size="sm"
                onClick={() => void applySelected()}
                disabled={busy}
              >
                Apply selected changes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runValidation()}
                disabled={busy}
              >
                Validate setup
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void markStep({
                    workspaceId,
                    agentId,
                    step: "bootstrapPrimed",
                  })
                }
              >
                Mark bootstrap done
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void markStep({
                    workspaceId,
                    agentId,
                    step: "cronConfirmed",
                  })
                }
              >
                Mark cron done
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setChatDraft({
                    workspaceId: String(workspaceId),
                    sessionKey: detail.agent.sessionKey,
                    content: bootstrap,
                  });
                  router.push(`/chat/${detail.agent._id}`);
                }}
              >
                Open chat with bootstrap
              </Button>
            </div>
          </div>

          {REQUIRED_AGENT_SETUP_FILES.map((file) => (
            <div
              key={file}
              className="rounded-xl border border-border-default bg-bg-secondary p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs text-text-primary">{file}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={ops[file] ?? "skip"}
                    onChange={(e) =>
                      setOps((prev) => ({
                        ...prev,
                        [file]: e.target.value as OperationMode,
                      }))
                    }
                    className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary"
                  >
                    <option value="keep_existing">keep existing</option>
                    <option value="create">create</option>
                    <option value="replace">replace</option>
                    <option value="skip">skip</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => void copy(file, drafts[file] ?? "")}
                  >
                    {copiedId === file ? (
                      <Check className="h-4 w-4 text-status-active" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-text-dim">
                Current:{" "}
                {scan[file]
                  ? scan[file]?.exists
                    ? scan[file]?.changed
                      ? "changed"
                      : "unchanged"
                    : "missing"
                  : "not scanned"}
              </p>
              <Textarea
                value={drafts[file] ?? ""}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [file]: e.target.value }))
                }
                rows={10}
                className="mt-2 bg-bg-primary font-mono text-[11px]"
              />
            </div>
          ))}
        </div>
      ) : null}

      {mode === "chat" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 text-xs text-text-muted">
            Send one command card at a time to the main agent, paste output,
            then save/confirm.
          </div>
          {REQUIRED_AGENT_SETUP_FILES.map((file) => {
            const command = `Update ${file} in ${detail.effectiveWorkspaceFolderPath} for agent ${detail.agent.name} (${detail.agent.sessionKey}). Use this target content exactly:\\n\\n${drafts[file] ?? ""}`;
            return (
              <div
                key={file}
                className="rounded-xl border border-border-default bg-bg-secondary p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs text-text-primary">{file}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copy(`cmd-${file}`, command)}
                  >
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    Copy command card
                  </Button>
                </div>
                <Textarea
                  value={chatPasted[file] ?? ""}
                  onChange={(e) =>
                    setChatPasted((prev) => ({
                      ...prev,
                      [file]: e.target.value,
                    }))
                  }
                  rows={8}
                  placeholder="Paste main-agent output for this file"
                  className="mt-2 bg-bg-primary font-mono text-[11px]"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void applyChatFile(file)}
                    disabled={busy || !(chatPasted[file] ?? "").trim()}
                  >
                    Save and confirm
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void runValidation()}
          >
            Validate setup
          </Button>
        </div>
      ) : null}

      {mode === "manual" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
            <p className="text-xs text-text-muted">
              Use quick replace actions or edit files directly in scoped
              filesystem.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {REQUIRED_AGENT_SETUP_FILES.map((file) => (
                <div
                  key={file}
                  className="flex items-center justify-between rounded-lg border border-border-default bg-bg-primary/60 px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-text-primary">
                    {file}
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void replaceFileWithTemplate(file)}
                    disabled={busy || !canEditFiles}
                  >
                    Replace
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runValidation()}
              >
                <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                Validate setup
              </Button>
            </div>
          </div>

          <ScopedFilesystemPanel
            workspaceId={workspaceId}
            canAdmin={canAdmin}
            canEditFiles={canEditFiles}
            basePath={detail.effectiveWorkspaceFolderPath}
            rootLabel={detail.effectiveWorkspaceFolderPath}
            showBridgeSetup={false}
          />
        </div>
      ) : null}

      <div className="rounded-xl border border-border-default bg-bg-secondary p-4 text-xs">
        <p className="text-text-primary">
          Completion status: {status.isComplete ? "Complete" : "Blocked"}
        </p>
        {!status.isComplete ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-text-muted">
            {!status.bootstrapPrimed ? (
              <li>Bootstrap step not confirmed.</li>
            ) : null}
            {!status.cronConfirmed ? <li>Cron step not confirmed.</li> : null}
            {!status.requiredFilesConfirmed ? (
              <li>All 8 required files are not confirmed/validated yet.</li>
            ) : null}
            {!status.pulseDetected ? (
              <li>First pulse not detected yet.</li>
            ) : null}
            {validationErrors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-xs text-status-blocked">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-status-active/40 bg-status-active/10 px-3 py-2 text-xs text-status-active">
          {success}
        </div>
      ) : null}
    </div>
  );
}
