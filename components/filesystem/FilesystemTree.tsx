"use client";

import type { MouseEvent } from "react";
import { ChevronUp, Folder, FolderOpen, FileText, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilesystemNode } from "./types";

export function FilesystemTree({
  items,
  currentPath,
  selectedPath,
  loading,
  onRefresh,
  onOpenParent,
  onOpenDirectory,
  onOpenFile,
  onContextMenu,
}: {
  items: FilesystemNode[];
  currentPath: string;
  selectedPath: string | null;
  loading?: boolean;
  onRefresh?: () => void;
  onOpenParent?: () => void;
  onOpenDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
  onContextMenu?: (event: MouseEvent, path: string) => void;
}) {
  const sorted = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary/80">
      <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
        <div className="truncate text-xs font-mono text-text-muted">{currentPath}</div>
        <div className="ml-2 flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenParent}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
            title="Parent directory"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
          </button>
        </div>
      </div>
      <div className="p-3">
      <div className="max-h-[420px] space-y-1 overflow-y-auto">
        {sorted.map((item) => {
          const isSelected = item.path === selectedPath;
          return (
            <button
              key={item.path}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-smooth",
                isSelected
                  ? "bg-accent-orange/10 text-accent-orange"
                  : "text-text-primary hover:bg-bg-tertiary",
              )}
              onClick={() =>
                item.type === "directory"
                  ? onOpenDirectory(item.path)
                  : onOpenFile(item.path)
              }
              onContextMenu={(event) => {
                if (item.type !== "file" || !onContextMenu) return;
                event.preventDefault();
                onContextMenu(event, item.path);
              }}
            >
              {item.type === "directory" ? (
                isSelected ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                )
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{item.name}</span>
              {item.type === "file" && item.size ? (
                <span className="ml-auto shrink-0 text-[10px] text-text-dim">
                  {Math.max(1, Math.round(item.size / 1024))}KB
                </span>
              ) : null}
            </button>
          );
        })}
        {sorted.length === 0 ? (
          <p className="px-2 py-3 text-xs text-text-dim">
            {loading ? "Loading..." : "No files"}
          </p>
        ) : null}
      </div>
      </div>
    </div>
  );
}
