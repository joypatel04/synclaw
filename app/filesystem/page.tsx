"use client";

import { FolderTree } from "lucide-react";
import { ScopedFilesystemPanel } from "@/components/filesystem";
import { AppLayout } from "@/components/layout/AppLayout";
import { LocalOpenClawConfigEditor } from "@/components/openclaw/LocalOpenClawConfigEditor";
import { useWorkspace } from "@/components/providers/workspace-provider";

function FilesystemContent() {
  const { workspaceId, canAdmin, role } = useWorkspace();
  const canEditFiles = role === "owner" || role === "admin";

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6">
      <div className="mb-6 overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
        <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3 sm:px-6">
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
      </div>

      <ScopedFilesystemPanel
        workspaceId={workspaceId}
        canAdmin={canAdmin}
        canEditFiles={canEditFiles}
        rootLabel="/root/.openclaw"
        showBridgeSetup
      />

      <div className="mt-6 rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
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
  );
}

export default function FilesystemPage() {
  return (
    <AppLayout>
      <FilesystemContent />
    </AppLayout>
  );
}
