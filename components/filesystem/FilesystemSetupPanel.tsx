"use client";

import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FilesystemSetupPanel({
  canAdmin,
  filesBridgeEnabled,
  filesBridgeBaseUrl,
  filesBridgeRootPath,
  filesBridgeTokenDraft,
  hasFilesBridgeToken,
  filesBridgeTokenClear,
  saving,
  testing,
  saveError,
  saveOk,
  statusText,
  setFilesBridgeEnabled,
  setFilesBridgeBaseUrl,
  setFilesBridgeRootPath,
  setFilesBridgeTokenDraft,
  onClearToken,
  onSave,
  onTest,
  showPreConnectionHelp,
}: {
  canAdmin: boolean;
  filesBridgeEnabled: boolean;
  filesBridgeBaseUrl: string;
  filesBridgeRootPath: string;
  filesBridgeTokenDraft: string;
  hasFilesBridgeToken: boolean;
  filesBridgeTokenClear: boolean;
  saving: boolean;
  testing: boolean;
  saveError: string | null;
  saveOk: boolean;
  statusText?: string;
  setFilesBridgeEnabled: (value: boolean) => void;
  setFilesBridgeBaseUrl: (value: string) => void;
  setFilesBridgeRootPath: (value: string) => void;
  setFilesBridgeTokenDraft: (value: string) => void;
  onClearToken: () => void;
  onSave: () => void;
  onTest: () => void;
  showPreConnectionHelp: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-text-primary mb-4">
        Workspace Files Bridge Setup
      </h2>
      {showPreConnectionHelp ? (
        <div className="mb-4 rounded-lg border border-status-review/40 bg-status-review/10 px-3 py-3 text-xs text-status-review">
          <p className="font-medium text-status-review">
            To use Filesystem, deploy fs-bridge on your server first.
          </p>
          <p className="mt-1">
            Then configure Base URL, Root Path, Token, Save, and click Test
            bridge.
          </p>
          <p className="mt-1">
            Need help running fs-bridge? Contact{" "}
            <a
              href="mailto:joypatel041994@gmail.com"
              className="underline underline-offset-2"
            >
              joypatel041994@gmail.com
            </a>
            .
          </p>
        </div>
      ) : null}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={filesBridgeEnabled}
            onChange={(e) => setFilesBridgeEnabled(e.target.checked)}
            className="h-4 w-4 accent-accent-orange"
            disabled={!canAdmin}
          />
          Enable remote OpenClaw workspace file bridge
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-text-secondary">Bridge base URL</Label>
            <Input
              value={filesBridgeBaseUrl}
              onChange={(e) => setFilesBridgeBaseUrl(e.target.value)}
              placeholder="https://files.yourdomain.com"
              className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
              disabled={!canAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-text-secondary">Workspace root path</Label>
            <Input
              value={filesBridgeRootPath}
              onChange={(e) => setFilesBridgeRootPath(e.target.value)}
              placeholder="/root/.openclaw/workspace"
              className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
              disabled={!canAdmin}
            />
            <p className="text-[11px] text-text-dim">
              This should match the bridge container `WORKSPACE_ROOT_PATH`.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-text-primary font-medium">
              Bridge token
            </p>
            <p className="text-xs text-text-dim">
              Status:{" "}
              <span
                className={
                  hasFilesBridgeToken ? "text-status-active" : "text-text-muted"
                }
              >
                {hasFilesBridgeToken ? "Set" : "Not set"}
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onClearToken}
            disabled={!hasFilesBridgeToken || !canAdmin}
          >
            Clear bridge token
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-text-secondary">Replace bridge token</Label>
          <Input
            value={filesBridgeTokenDraft}
            onChange={(e) => setFilesBridgeTokenDraft(e.target.value)}
            placeholder="Paste bridge bearer token..."
            className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim font-mono text-xs"
            disabled={!canAdmin}
          />
          {filesBridgeTokenClear ? (
            <p className="text-[11px] text-status-blocked">
              Bridge token will be cleared on Save.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onSave}
            disabled={saving || !canAdmin}
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={onTest}
            disabled={testing}
            className="gap-2"
          >
            <Activity className="h-4 w-4" />
            {testing ? "Testing..." : "Test bridge"}
          </Button>
          {saveOk ? (
            <span className="text-xs text-status-active">Saved</span>
          ) : null}
          {saveError ? (
            <span className="text-xs text-status-blocked">{saveError}</span>
          ) : null}
          {statusText ? (
            <span className="text-xs text-status-active">{statusText}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
