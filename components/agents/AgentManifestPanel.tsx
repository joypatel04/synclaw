"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Copy, Download, Upload } from "lucide-react";
import {
  buildAgentManifest,
  parseAgentManifest,
  type AgentManifestAgent,
} from "@/lib/agentManifest";
import { buildAgentsMd } from "@/lib/agentDocs";

function downloadText(
  filename: string,
  content: string,
  mime: string = "text/plain;charset=utf-8",
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AgentManifestPanel() {
  const { workspaceId, workspace, canAdmin } = useWorkspace();
  const agents =
    useQuery(api.agents.list, canAdmin ? { workspaceId, includeArchived: true } : "skip") ??
    [];
  const createAgent = useMutation(api.agents.create);

  const manifestObj = useMemo(() => {
    const rows: AgentManifestAgent[] = agents
      .filter((a: any) => !a.isArchived)
      .map((a: any) => ({
        name: a.name,
        role: a.role,
        emoji: a.emoji,
        sessionKey: a.sessionKey,
        externalAgentId: a.externalAgentId ?? undefined,
      }));
    return buildAgentManifest({ workspaceId: String(workspaceId), agents: rows });
  }, [agents, workspaceId]);

  const manifestText = useMemo(() => {
    return JSON.stringify(manifestObj, null, 2);
  }, [manifestObj]);

  const agentsMd = useMemo(() => {
    return buildAgentsMd({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agents: agents
        .filter((a: any) => !a.isArchived)
        .map((a: any) => ({
          name: a.name,
          sessionKey: a.sessionKey,
          role: a.role,
          emoji: a.emoji,
          agentId: a._id as string,
        })),
    });
  }, [agents, workspace.name, workspaceId]);

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(manifestText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importOk, setImportOk] = useState(false);
  const [importing, setImporting] = useState(false);

  const existingSessionKeys = useMemo(() => {
    return new Set(agents.map((a: any) => a.sessionKey));
  }, [agents]);

  const parsed = useMemo(() => {
    if (!importText.trim()) return null;
    try {
      const json = JSON.parse(importText);
      const res = parseAgentManifest(json);
      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const, value: res.value };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [importText]);

  const importPlan = useMemo(() => {
    if (!parsed || !parsed.ok) return null;
    const incoming = parsed.value.agents;
    const create = incoming.filter((a) => !existingSessionKeys.has(a.sessionKey));
    const skip = incoming.filter((a) => existingSessionKeys.has(a.sessionKey));
    return { create, skip, total: incoming.length };
  }, [parsed, existingSessionKeys]);

  const onPickFile = async (file: File) => {
    setImportError(null);
    setImportOk(false);
    try {
      const text = await file.text();
      setImportText(text);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    }
  };

  const onImport = async () => {
    if (!canAdmin) return;
    if (!importPlan) return;
    if (importPlan.create.length === 0) return;
    setImporting(true);
    setImportError(null);
    setImportOk(false);
    try {
      for (const a of importPlan.create) {
        await createAgent({
          workspaceId,
          name: a.name,
          role: a.role,
          emoji: a.emoji,
          sessionKey: a.sessionKey,
          externalAgentId: a.externalAgentId ?? a.sessionKey,
        });
      }
      setImportOk(true);
      setTimeout(() => setImportOk(false), 2000);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  if (!canAdmin) return null;

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Agent manifest (import/export)
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Keep a lightweight JSON manifest in your OpenClaw repo (e.g.{" "}
            <span className="font-mono">sutraha.agents.json</span>) to reproduce agents across environments.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() =>
                downloadText(
                  `sutraha.agents.${String(workspaceId).slice(0, 6)}.json`,
                  manifestText,
                  "application/json;charset=utf-8",
                )
              }
            >
              <Download className="h-4 w-4" />
              Export
          </Button>
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
              title="Export a human-readable AGENTS.md template"
            >
            <Download className="h-4 w-4" />
            AGENTS.md
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
            onClick={() => void copy()}
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

      <pre className="mt-4 max-h-[240px] overflow-auto rounded-lg bg-bg-primary border border-border-default p-3 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
        {manifestText}
      </pre>

      <div className="mt-6 border-t border-border-default pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
              Import
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Paste a manifest JSON below, or upload a file.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        <Textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={8}
          placeholder="Paste sutraha.agents.json here…"
          className="mt-3 bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
        />

        {parsed && !parsed.ok ? (
          <p className="mt-2 text-xs text-status-blocked">{parsed.error}</p>
        ) : null}
        {importError ? (
          <p className="mt-2 text-xs text-status-blocked">{importError}</p>
        ) : null}

        {importPlan ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-text-muted">
              Found {importPlan.total} agent(s): create {importPlan.create.length}, skip{" "}
              {importPlan.skip.length} (already exist).
            </p>
            <div className="flex items-center gap-2">
              {importOk ? (
                <span className="text-xs text-status-active">Imported</span>
              ) : null}
              <Button
                size="sm"
                className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
                disabled={importing || importPlan.create.length === 0}
                onClick={() => void onImport()}
                title={importPlan.create.length === 0 ? "Nothing to import" : "Create missing agents"}
              >
                {importing ? "Importing..." : "Import missing agents"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
