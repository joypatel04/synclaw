"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Lock, PencilLine, Server } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AGENT_SETUP_ADVANCED_ENABLED,
  OPENCLAW_FILES_ENABLED,
} from "@/lib/features";
import { FilesystemContextMenu } from "./FilesystemContextMenu";
import { FilesystemEditor } from "./FilesystemEditor";
import { FilesystemSetupPanel } from "./FilesystemSetupPanel";
import { FilesystemTree } from "./FilesystemTree";
import { MobileFilesystemDrawer } from "./MobileFilesystemDrawer";
import type { FilesystemNode } from "./types";

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
  mime?: string;
  encoding?: "utf8" | "base64" | string;
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

type DeleteFileResponse = {
  ok: boolean;
  path: string;
};

export function ScopedFilesystemPanel({
  workspaceId,
  canAdmin,
  canEditFiles,
  basePath,
  rootLabel,
  showBridgeSetup = true,
}: {
  workspaceId: Id<"workspaces">;
  canAdmin: boolean;
  canEditFiles: boolean;
  basePath?: string;
  rootLabel: string;
  showBridgeSetup?: boolean;
}) {
  const summary = useQuery(api.openclaw.getConfigSummary, { workspaceId });
  const upsert = useMutation(api.openclaw.upsertConfig);
  const testBridge = useAction(api.openclaw_files.testBridge);
  const listTree = useAction(api.openclaw_files.listTree);
  const readFile = useAction(api.openclaw_files.readFile);
  const writeFile = useAction(api.openclaw_files.writeFile);
  const deleteFile = useAction(api.openclaw_files.deleteFile);

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
  const [selectedMime, setSelectedMime] = useState<string | null>(null);
  const [selectedEncoding, setSelectedEncoding] = useState<
    "utf8" | "base64" | string
  >("utf8");
  const [expectedHash, setExpectedHash] = useState<string | undefined>();
  const [selectedSize, setSelectedSize] = useState<number | undefined>();
  const [selectedMtimeMs, setSelectedMtimeMs] = useState<number | undefined>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [bridgeTestSucceeded, setBridgeTestSucceeded] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const [contextOpen, setContextOpen] = useState(false);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const [contextPath, setContextPath] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(showBridgeSetup);

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
    if (showBridgeSetup) {
      setShowSetup(!configured);
    }
  }, [summary, showBridgeSetup]);

  const hasFilesBridgeToken = summary?.hasFilesBridgeToken ?? false;
  const hasBridgeConfigured = Boolean(
    summary?.filesBridgeEnabled && summary?.filesBridgeBaseUrl,
  );

  const scopedArgs = useMemo(() => (basePath ? { basePath } : {}), [basePath]);

  const openDirectory = useCallback(
    async (path: string, force = false) => {
      const normalized = path === "" ? "." : path;
      if (!force && treeByPath[normalized]) return;
      setLoadingDirs((prev) => new Set(prev).add(normalized));
      setError(null);
      try {
        const result = await listTree({
          workspaceId,
          path: normalized,
          ...scopedArgs,
        });
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
    },
    [listTree, scopedArgs, treeByPath, workspaceId],
  );

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
      const result = await readFile({ workspaceId, path, ...scopedArgs });
      const typed = result as ReadFileResponse;
      setSelectedPath(path);
      setContent(typed.content ?? "");
      setSelectedMime(
        typeof typed.mime === "string" && typed.mime.length > 0
          ? typed.mime
          : "text/plain",
      );
      setSelectedEncoding(typed.encoding ?? "utf8");
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
    if (selectedMime === "application/pdf" || selectedEncoding === "base64") {
      setError("PDF files are read-only in this editor.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await writeFile({
        workspaceId,
        path: selectedPath,
        content,
        expectedHash,
        ...scopedArgs,
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
        setBridgeTestSucceeded(true);
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

  const deletePathFromContext = async (path: string) => {
    if (!canEditFiles || deletingPath) return;
    const confirmed = window.confirm(
      `Delete file?\n\n${path}\n\nThis action cannot be undone.`,
    );
    if (!confirmed) {
      setContextOpen(false);
      return;
    }
    setDeletingPath(path);
    setError(null);
    try {
      const result = await deleteFile({ workspaceId, path, ...scopedArgs });
      const typed = result as DeleteFileResponse;
      const deletedPath = typed.path ?? path;
      if (selectedPath === deletedPath) {
        setSelectedPath(null);
        setContent("");
        setSelectedMime(null);
        setSelectedEncoding("utf8");
        setExpectedHash(undefined);
        setSelectedSize(undefined);
        setSelectedMtimeMs(undefined);
        setDirty(false);
      }
      setStatusText(`Deleted ${deletedPath}`);
      await openDirectory(parentPath(deletedPath), true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingPath(null);
      setContextOpen(false);
    }
  };

  const onSaveSetup = async () => {
    if (!canAdmin || !summary) {
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
    if (!OPENCLAW_FILES_ENABLED) return "disabled" as const;
    if (!summary?.wsUrl) return "needs_openclaw" as const;
    if (!hasBridgeConfigured) return "needs_bridge" as const;
    return "ready" as const;
  }, [summary?.wsUrl, hasBridgeConfigured]);

  useEffect(() => {
    if (filesystemState !== "ready") return;
    if (loadingDirs.has(".")) return;
    if (treeByPath["."]?.length) return;
    void openDirectory(".", true);
  }, [filesystemState, loadingDirs, treeByPath, openDirectory]);

  const missingFolder =
    Boolean(basePath) &&
    !!error &&
    (error.toLowerCase().includes("no such file") ||
      error.toLowerCase().includes("enoent") ||
      error.toLowerCase().includes("not found"));

  if (filesystemState === "disabled") {
    return (
      <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
        <p className="text-sm text-text-muted">
          Filesystem feature is disabled. Set{" "}
          <code className="font-mono text-xs">
            NEXT_PUBLIC_OPENCLAW_FILES_ENABLED=true
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border-default bg-bg-secondary">
        <div className="flex flex-col gap-3 border-b border-border-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1">
              <Server className="h-3 w-3" />
              {hasBridgeConfigured
                ? "Bridge configured"
                : "Bridge not configured"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1">
              {canEditFiles ? (
                <PencilLine className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {canEditFiles ? "Edit enabled" : "Read only"}
            </span>
          </div>
          {showBridgeSetup && filesystemState === "ready" ? (
            <button
              type="button"
              className="text-xs text-text-muted underline underline-offset-4 hover:text-text-primary"
              onClick={() => setShowSetup((v) => !v)}
            >
              {showSetup ? "Hide bridge setup" : "Manage bridge setup"}
            </button>
          ) : null}
        </div>
        <div className="px-4 py-3 text-xs text-text-dim">
          Root path:{" "}
          <span className="font-mono text-text-muted">{rootLabel}</span>
        </div>
      </div>

      {showBridgeSetup && (showSetup || filesystemState !== "ready") ? (
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
          showPreConnectionHelp={!bridgeTestSucceeded}
        />
      ) : null}

      {!showBridgeSetup && filesystemState !== "ready" ? (
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 text-sm text-text-muted">
          Files bridge is not ready. Configure it in{" "}
          <Link
            href="/filesystem"
            className="text-text-secondary hover:underline"
          >
            Filesystem settings
          </Link>
          .
        </div>
      ) : null}

      {filesystemState === "needs_openclaw" ? (
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 text-sm text-text-muted">
          Configure OpenClaw connection first in{" "}
          <Link
            href="/settings/openclaw"
            className="text-text-secondary hover:underline"
          >
            Settings - OpenClaw
          </Link>
          .
        </div>
      ) : null}

      {filesystemState === "needs_bridge" && showBridgeSetup ? (
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 text-sm text-text-muted">
          Save bridge settings and click Test bridge to load filesystem.
        </div>
      ) : null}

      {filesystemState === "ready" ? (
        <>
          {missingFolder ? (
            <div className="space-y-3 rounded-xl border border-status-review/50 bg-status-review/10 p-4 text-xs text-status-review">
              <p className="font-medium">
                Agent workspace folder is missing:{" "}
                <span className="font-mono">{basePath}</span>
              </p>
              <p className="text-status-review/90">
                Filesystem will stay read-only until this folder exists under
                your fs-bridge root path.
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-status-review/90">
                <li>
                  In OpenClaw, create folder{" "}
                  <span className="font-mono">{basePath}</span> in your
                  workspace root.
                </li>
                <li>
                  Add baseline agent files (at minimum{" "}
                  <span className="font-mono">SYNCLAW_PROTOCOL.md</span> and{" "}
                  <span className="font-mono">HEARTBEAT.md</span>).
                </li>
                <li>Return here and click refresh to load the folder.</li>
              </ol>
              <div className="flex flex-wrap gap-3 text-xs">
                {AGENT_SETUP_ADVANCED_ENABLED ? (
                  <Link
                    href="/help/agent-setup"
                    className="text-text-secondary hover:underline"
                  >
                    Open Agent Setup Guide
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="text-text-secondary hover:underline"
                  onClick={() => void openDirectory(".", true)}
                >
                  Refresh Filesystem
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="hidden lg:block">
              <FilesystemTree
                rootPath={rootLabel}
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
                rootPath={rootLabel}
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
                selectedMime={selectedMime}
                selectedEncoding={selectedEncoding}
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
        </>
      ) : null}

      <FilesystemContextMenu
        open={contextOpen}
        x={contextX}
        y={contextY}
        path={contextPath}
        canDelete={canEditFiles}
        deleting={Boolean(deletingPath)}
        onDelete={deletePathFromContext}
        onClose={() => setContextOpen(false)}
      />
    </div>
  );
}
