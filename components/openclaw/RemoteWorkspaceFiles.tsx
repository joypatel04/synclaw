"use client";

import { useMemo, useState } from "react";
import { useAction } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FolderTree, RefreshCw, Save } from "lucide-react";
import Link from "next/link";

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  mtimeMs?: number;
};

const ALLOWED_EXTENSIONS = [
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".config",
];

function isSupportedFile(path: string) {
  const lower = path.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function RemoteWorkspaceFiles({
  workspaceId,
  bridgeEnabled,
}: {
  workspaceId: Id<"workspaces">;
  bridgeEnabled: boolean;
}) {
  const testBridge = useAction((api as any).openclaw_files.testBridge);
  const listTree = useAction((api as any).openclaw_files.listTree);
  const readFile = useAction((api as any).openclaw_files.readFile);
  const writeFile = useAction((api as any).openclaw_files.writeFile);

  const [currentPath, setCurrentPath] = useState(".");
  const [items, setItems] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [content, setContent] = useState("");
  const [expectedHash, setExpectedHash] = useState<string | undefined>(
    undefined,
  );

  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const loadTree = async (path = currentPath) => {
    setBusy(true);
    setError(null);
    try {
      const result = await listTree({ workspaceId, path });
      const nextPath = String((result as any)?.path ?? path);
      const nextItems = Array.isArray((result as any)?.items)
        ? ((result as any).items as FileNode[])
        : [];
      setCurrentPath(nextPath);
      setItems(nextItems);
      setStatusText(`Loaded ${nextItems.length} items`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (path: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await readFile({ workspaceId, path });
      setSelectedPath(path);
      setContent(String((result as any)?.content ?? ""));
      setExpectedHash(
        typeof (result as any)?.hash === "string"
          ? (result as any).hash
          : undefined,
      );
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
      const newHash =
        typeof (result as any)?.hash === "string"
          ? (result as any).hash
          : undefined;
      setExpectedHash(newHash);
      setDirty(false);
      setStatusText(`Saved ${selectedPath}`);
      await loadTree(currentPath);
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
      const ok = Boolean((result as any)?.ok);
      setStatusText(ok ? "Bridge connected" : "Bridge test failed");
      if (ok) await loadTree(".");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  if (!bridgeEnabled) {
    return (
      <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-text-primary">
          Workspace Files (Remote)
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          Enable Files Bridge and save settings to browse/edit your OpenClaw
          workspace directory.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Workspace Files (Remote)
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Text files only: {ALLOWED_EXTENSIONS.join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => void runTest()}
            disabled={testing}
          >
            {testing ? "Testing..." : "Test bridge"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void loadTree(".")}
            disabled={busy}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border-default bg-bg-tertiary p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <FolderTree className="h-3.5 w-3.5" />
            <span className="font-mono">{currentPath}</span>
          </div>
          <div className="max-h-[360px] space-y-1 overflow-y-auto">
            {sortedItems.map((item) => (
              <button
                key={item.path}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-text-primary hover:bg-bg-primary"
                onClick={() => {
                  if (dirty) {
                    setError("Save current file before switching.");
                    return;
                  }
                  if (item.type === "directory") {
                    void loadTree(item.path);
                    return;
                  }
                  if (!isSupportedFile(item.path)) {
                    setError("Unsupported file type for editor.");
                    return;
                  }
                  void openFile(item.path);
                }}
              >
                <span className="truncate">
                  {item.type === "directory" ? "📁" : "📄"} {item.name}
                </span>
                {item.type === "file" && item.size !== undefined ? (
                  <span className="ml-2 text-[10px] text-text-dim">
                    {Math.round(item.size / 1024)}KB
                  </span>
                ) : null}
              </button>
            ))}
            {sortedItems.length === 0 ? (
              <p className="px-2 py-4 text-xs text-text-dim">No files</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border-default bg-bg-tertiary p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Input
              value={selectedPath}
              readOnly
              placeholder="Select a file from the tree..."
              className="h-8 bg-bg-primary border-border-default text-text-primary text-xs font-mono"
            />
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => void saveFile()}
              disabled={!selectedPath || !dirty || busy}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            rows={14}
            className="bg-bg-primary border-border-default text-text-primary font-mono text-[12px]"
            placeholder="Open a text file to edit..."
            disabled={!selectedPath || busy}
          />
          <p className="mt-2 text-[11px] text-text-dim">
            Fallback local editor:{" "}
            <Link href="/settings/openclaw" className="text-text-secondary hover:underline">
              Local OpenClaw config editor
            </Link>
          </p>
        </div>
      </div>

      {statusText ? (
        <p className="mt-3 text-xs text-status-active">{statusText}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-status-blocked">{error}</p> : null}
    </div>
  );
}
