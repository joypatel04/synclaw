"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  RefreshCw,
} from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import type { FilesystemNode } from "./types";

function sortNodes(items: FilesystemNode[]): FilesystemNode[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function TreeRow({
  node,
  depth,
  selectedPath,
  expandedDirs,
  loadingDirs,
  treeByPath,
  onToggleDirectory,
  onOpenFile,
  onContextMenu,
}: {
  node: FilesystemNode;
  depth: number;
  selectedPath: string | null;
  expandedDirs: Set<string>;
  loadingDirs: Set<string>;
  treeByPath: Record<string, FilesystemNode[]>;
  onToggleDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
  onContextMenu?: (event: MouseEvent, path: string) => void;
}) {
  const isDirectory = node.type === "directory";
  const isExpanded = expandedDirs.has(node.path);
  const isLoading = loadingDirs.has(node.path);
  const isSelected = selectedPath === node.path;
  const children = isDirectory ? sortNodes(treeByPath[node.path] ?? []) : [];

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-smooth",
          isSelected
            ? "bg-bg-hover text-text-secondary"
            : "text-text-primary hover:bg-bg-tertiary",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() =>
          isDirectory ? onToggleDirectory(node.path) : onOpenFile(node.path)
        }
        onContextMenu={(event) => {
          if (!onContextMenu || isDirectory) return;
          event.preventDefault();
          onContextMenu(event, node.path);
        }}
      >
        {isDirectory ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          )
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}
        {isDirectory ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        )}
        <span className="truncate">{node.name}</span>
        {isLoading ? (
          <span className="ml-auto text-[10px] text-text-dim">loading...</span>
        ) : node.type === "file" && node.size ? (
          <span className="ml-auto shrink-0 text-[10px] text-text-dim">
            {Math.max(1, Math.round(node.size / 1024))}KB
          </span>
        ) : null}
      </button>

      {isDirectory && isExpanded
        ? children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              loadingDirs={loadingDirs}
              treeByPath={treeByPath}
              onToggleDirectory={onToggleDirectory}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
            />
          ))
        : null}
    </div>
  );
}

export function FilesystemTree({
  rootPath,
  treeByPath,
  selectedPath,
  expandedDirs,
  loadingDirs,
  onRefreshRoot,
  onToggleDirectory,
  onOpenFile,
  onContextMenu,
}: {
  rootPath: string;
  treeByPath: Record<string, FilesystemNode[]>;
  selectedPath: string | null;
  expandedDirs: Set<string>;
  loadingDirs: Set<string>;
  onRefreshRoot: () => void;
  onToggleDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
  onContextMenu?: (event: MouseEvent, path: string) => void;
}) {
  const rootItems = sortNodes(treeByPath["."] ?? []);
  const loadingRoot = loadingDirs.has(".");

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary/80">
      <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
        <div className="truncate text-xs font-mono text-text-muted">
          {rootPath}
        </div>
        <button
          type="button"
          onClick={onRefreshRoot}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
          title="Refresh"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", loadingRoot ? "animate-spin" : "")}
          />
        </button>
      </div>
      <div className="max-h-[560px] space-y-1 overflow-y-auto p-3">
        {rootItems.map((item) => (
          <TreeRow
            key={item.path}
            node={item}
            depth={0}
            selectedPath={selectedPath}
            expandedDirs={expandedDirs}
            loadingDirs={loadingDirs}
            treeByPath={treeByPath}
            onToggleDirectory={onToggleDirectory}
            onOpenFile={onOpenFile}
            onContextMenu={onContextMenu}
          />
        ))}
        {rootItems.length === 0 ? (
          <p className="px-2 py-3 text-xs text-text-dim">
            {loadingRoot ? "Loading..." : "No files"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
