"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { FolderTree, Lock, PencilLine, Server } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FilesystemContextMenu,
  FilesystemEditor,
  type FilesystemNode,
  FilesystemSetupPanel,
  FilesystemTree,
  MobileFilesystemDrawer,
} from "@/components/filesystem";
import { AppLayout } from "@/components/layout/AppLayout";
import { LocalOpenClawConfigEditor } from "@/components/openclaw/LocalOpenClawConfigEditor";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/convex/_generated/api";
import { OPENCLAW_FILES_ENABLED } from "@/lib/features";

function parentPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized.includes("/") || normalized === ".") return ".";
  const cut = normalized.slice(0, normalized.lastIndexOf("/"));
  return cut.length > 0 ? cut : ".";
}

type TreeResponse = {
  path: string;
  items: FilesystemNode[];
};

type ReadFileResponse = {
  path: string;
  content: string;
  hash?: string;
  size?: number;
  mtimeMs?: number;
};

type WriteFileResponse = {
  ok: boolean;
  path: string;
  hash?: string;
  size?: number;
  mtimeMs?: number;
};

type TestBridgeResponse = {
  ok: boolean;
};

function FilesystemContent() {
  const { workspaceId, canAdmin, role } = useWorkspace();
  const summary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const upsert = useMutation(api.openclaw.upsertConfig);
  const testBridge = useAction(api.openclaw_files.testBridge);
  const listTree = useAction(api.openclaw_files.listTree);
  const readFile = useAction(api.openclaw_files.readFile);
  const writeFile = useAction(api.openclaw_files.writeFile);

  const canEditFiles = role === "owner" || role === "admin";

  const [filesBridgeEnabled, setFilesBridgeEnabled] = useState(false);
  const [filesBridgeBaseUrl, setFilesBridgeBaseUrl] = useState("");
  const [filesBridgeRootPath, setFilesBridgeRootPath] = useState("");
  const [filesBridgeTokenDraft, setFilesBridgeTokenDraft] = useState("");
  const [filesBridgeTokenClear, setFilesBridgeTokenClear] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const [treeByPath, setTreeByPath] = useState<
    Record<string, FilesystemNode[]>
  >({});
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["."]));
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [expectedHash, setExpectedHash] = useState<string | undefined>();
  const [selectedSize, setSelectedSize] = useState<number | undefined>();
  const [selectedMtimeMs, setSelectedMtimeMs] = useState<number | undefined>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [contextOpen, setContextOpen] = useState(false);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const [contextPath, setContextPath] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(true);

  useEffect(() => {
    if (!summary) return;
    setFilesBridgeEnabled(Boolean(summary.filesBridgeEnabled));
    setFilesBridgeBaseUrl(summary.filesBridgeBaseUrl ?? "");
    setFilesBridgeRootPath(summary.filesBridgeRootPath ?? "");
    setFilesBridgeTokenDraft("");
    setFilesBridgeTokenClear(false);
    const configured = Boolean(
      summary.filesBridgeEnabled && summary.filesBridgeBaseUrl,
    );
    setShowSetup(!configured);
  }, [summary]);

  const hasFilesBridgeToken = summary?.hasFilesBridgeToken ?? false;
  const hasBridgeConfigured = Boolean(
    summary?.filesBridgeEnabled && summary?.filesBridgeBaseUrl,
  );

  const openDirectory = async (path: string, force = false) => {
    const normalized = path === "" ? "." : path;
    if (!force && treeByPath[normalized]) return;
    setLoadingDirs((prev) => new Set(prev).add(normalized));
    setError(null);
    try {
      const result = await listTree({ workspaceId, path: normalized });
      const typed = result as TreeResponse;
      const resolvedPath = typed.path ?? normalized;
      const nextItems = Array.isArray(typed.items) ? typed.items : [];
      setTreeByPath((prev) => ({ ...prev, [resolvedPath]: nextItems }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingDirs((prev) => {
        const next = new Set(prev);
        next.delete(normalized);
        return next;
      });
    }
  };

  const toggleDirectory = async (path: string) => {
    const isExpanded = expandedDirs.has(path);
    if (isExpanded) {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      return;
    }
    setExpandedDirs((prev) => new Set(prev).add(path));
    await openDirectory(path);
  };

  const openFile = async (path: string) => {
    if (dirty) {
      setError("Save current file before switching.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await readFile({ workspaceId, path });
      const typed = result as ReadFileResponse;
      setSelectedPath(path);
      setContent(typed.content ?? "");
      setExpectedHash(typed.hash);
      setSelectedSize(typed.size);
      setSelectedMtimeMs(typed.mtimeMs);
      setDirty(false);
      setStatusText(`Opened ${path}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveFile = async () => {
    if (!selectedPath) return;
    setBusy(true);
    setError(null);
    try {
      const result = await writeFile({
        workspaceId,
        path: selectedPath,
        content,
        expectedHash,
      });
      const typed = result as WriteFileResponse;
      setExpectedHash(typed.hash);
      setSelectedSize(typed.size);
      setSelectedMtimeMs(typed.mtimeMs);
      setDirty(false);
      setStatusText(`Saved ${selectedPath}`);
      await openDirectory(parentPath(selectedPath), true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setError(null);
    try {
      const result = await testBridge({ workspaceId });
      const typed = result as TestBridgeResponse;
      if (typed.ok) {
        setStatusText("Bridge connected");
        await openDirectory(".", true);
      } else {
        setStatusText("Bridge test failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const onSaveSetup = async () => {
    if (!canAdmin) return;
    if (!summary) {
      setSaveError("Configure OpenClaw connection first.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await upsert({
        workspaceId,
        wsUrl: summary.wsUrl ?? "",
        protocol: (summary.protocol as "req" | "jsonrpc") ?? "req",
        clientId: summary.clientId ?? "openclaw-control-ui",
        clientMode: summary.clientMode ?? "webchat",
        clientPlatform: summary.clientPlatform ?? "web",
        role: summary.role ?? "operator",
        scopes: Array.isArray(summary.scopes) ? summary.scopes : [],
        subscribeOnConnect: Boolean(summary.subscribeOnConnect),
        subscribeMethod: summary.subscribeMethod ?? "chat.subscribe",
        includeCron: Boolean(summary.includeCron),
        historyPollMs: Number(summary.historyPollMs ?? 5000),
        filesBridgeEnabled,
        filesBridgeBaseUrl,
        filesBridgeRootPath,
        filesBridgeToken: filesBridgeTokenClear
          ? null
          : filesBridgeTokenDraft
            ? filesBridgeTokenDraft
            : undefined,
      });
      setFilesBridgeTokenDraft("");
      setFilesBridgeTokenClear(false);
      setShowSetup(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const setEditorContent = (value: string) => {
    setContent(value);
    setDirty(true);
  };

  const filesystemState = useMemo(() => {
    if (!OPENCLAW_FILES_ENABLED) {
      return "disabled" as const;
    }
    if (!summary?.wsUrl) {
      return "needs_openclaw" as const;
    }
    if (!hasBridgeConfigured) {
      return "needs_bridge" as const;
    }
    return "ready" as const;
  }, [summary?.wsUrl, hasBridgeConfigured]);

  useEffect(() => {
    if (filesystemState !== "ready") return;
    if (loadingDirs.has(".")) return;
    if (treeByPath["."]?.length) return;
    void (async () => {
      setLoadingDirs((prev) => new Set(prev).add("."));
      setError(null);
      try {
        const result = await listTree({ workspaceId, path: "." });
        const typed = result as TreeResponse;
        const resolvedPath = typed.path ?? ".";
        const nextItems = Array.isArray(typed.items) ? typed.items : [];
        setTreeByPath((prev) => ({ ...prev, [resolvedPath]: nextItems }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingDirs((prev) => {
          const next = new Set(prev);
          next.delete(".");
          return next;
        });
      }
    })();
  }, [filesystemState, listTree, loadingDirs, treeByPath, workspaceId]);

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6">
      <div className="mb-6 overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
              <FolderTree className="h-4 w-4 text-text-muted" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary sm:text-xl">
                Filesystem
              </h1>
              <p className="text-xs text-text-muted">
                Browse and edit remote OpenClaw workspace files.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-text-muted">
              <Server className="h-3 w-3" />
              {hasBridgeConfigured
                ? "Bridge configured"
                : "Bridge not configured"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-text-muted">
              {canEditFiles ? (
                <PencilLine className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {canEditFiles ? "Edit enabled" : "Read only"}
            </span>
          </div>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-xs text-text-dim">
            Root path:{" "}
            <span className="font-mono text-text-muted">
              {filesBridgeRootPath || "/root/.openclaw/workspace"}
            </span>
          </p>
        </div>
      </div>

      {filesystemState === "disabled" ? (
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
          <p className="text-sm text-text-muted">
            Filesystem feature is disabled. Set{" "}
            <code className="font-mono text-xs">
              NEXT_PUBLIC_OPENCLAW_FILES_ENABLED=true
            </code>
            .
          </p>
        </div>
      ) : null}

      {filesystemState !== "disabled" ? (
        <div className="space-y-6">
          {filesystemState === "ready" ? (
            <div className="flex items-center justify-end">
              <button
                type="button"
                className="text-xs text-text-muted underline underline-offset-4 hover:text-text-primary"
                onClick={() => setShowSetup((v) => !v)}
              >
                {showSetup ? "Hide bridge setup" : "Manage bridge setup"}
              </button>
            </div>
          ) : null}

          {showSetup || filesystemState !== "ready" ? (
            <FilesystemSetupPanel
              canAdmin={canAdmin}
              filesBridgeEnabled={filesBridgeEnabled}
              filesBridgeBaseUrl={filesBridgeBaseUrl}
              filesBridgeRootPath={filesBridgeRootPath}
              filesBridgeTokenDraft={filesBridgeTokenDraft}
              hasFilesBridgeToken={hasFilesBridgeToken}
              filesBridgeTokenClear={filesBridgeTokenClear}
              saving={saving}
              testing={testing}
              saveError={saveError}
              saveOk={saveOk}
              statusText={statusText}
              setFilesBridgeEnabled={setFilesBridgeEnabled}
              setFilesBridgeBaseUrl={setFilesBridgeBaseUrl}
              setFilesBridgeRootPath={setFilesBridgeRootPath}
              setFilesBridgeTokenDraft={(value) => {
                setFilesBridgeTokenDraft(value);
                setFilesBridgeTokenClear(false);
              }}
              onClearToken={() => {
                setFilesBridgeTokenDraft("");
                setFilesBridgeTokenClear(true);
              }}
              onSave={() => void onSaveSetup()}
              onTest={() => void runTest()}
            />
          ) : null}

          {filesystemState === "needs_openclaw" ? (
            <div className="rounded-xl border border-border-default bg-bg-secondary p-4 text-sm text-text-muted">
              Configure OpenClaw connection first in{" "}
              <Link
                href="/settings/openclaw"
                className="text-accent-orange hover:underline"
              >
                Settings - OpenClaw
              </Link>
              .
            </div>
          ) : filesystemState === "needs_bridge" ? (
            <div className="rounded-xl border border-border-default bg-bg-secondary p-4 text-sm text-text-muted">
              Save bridge settings and click Test bridge to load filesystem.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="hidden lg:block">
                <FilesystemTree
                  rootPath={filesBridgeRootPath || "/root/.openclaw/workspace"}
                  treeByPath={treeByPath}
                  selectedPath={selectedPath}
                  expandedDirs={expandedDirs}
                  loadingDirs={loadingDirs}
                  onRefreshRoot={() => void openDirectory(".", true)}
                  onToggleDirectory={(path) => void toggleDirectory(path)}
                  onOpenFile={(path) => void openFile(path)}
                  onContextMenu={(event, path) => {
                    setContextOpen(true);
                    setContextX(event.clientX);
                    setContextY(event.clientY);
                    setContextPath(path);
                  }}
                />
              </div>
              <div className="space-y-3">
                <MobileFilesystemDrawer
                  rootPath={filesBridgeRootPath || "/root/.openclaw/workspace"}
                  treeByPath={treeByPath}
                  selectedPath={selectedPath}
                  expandedDirs={expandedDirs}
                  loadingDirs={loadingDirs}
                  onRefreshRoot={() => void openDirectory(".", true)}
                  onToggleDirectory={(path) => void toggleDirectory(path)}
                  onOpenFile={(path) => void openFile(path)}
                />
                <FilesystemEditor
                  selectedPath={selectedPath}
                  content={content}
                  dirty={dirty}
                  busy={busy}
                  canEdit={canEditFiles}
                  sizeBytes={selectedSize}
                  modifiedAt={selectedMtimeMs}
                  statusText={statusText}
                  onChange={setEditorContent}
                  onSave={() => void saveFile()}
                />
                {error ? (
                  <p className="text-xs text-status-blocked">{error}</p>
                ) : null}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-text-primary">
              Local fallback editor
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Use this when your remote bridge is unavailable.
            </p>
            <div className="mt-4">
              <LocalOpenClawConfigEditor />
            </div>
          </div>
        </div>
      ) : null}

      <FilesystemContextMenu
        open={contextOpen}
        x={contextX}
        y={contextY}
        path={contextPath}
        onClose={() => setContextOpen(false)}
      />
    </div>
  );
}

export default function FilesystemPage() {
  return (
    <AppLayout>
      <FilesystemContent />
    </AppLayout>
  );
}
