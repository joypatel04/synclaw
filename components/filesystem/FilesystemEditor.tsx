"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function FilesystemEditor({
  selectedPath,
  content,
  dirty,
  busy,
  canEdit,
  sizeBytes,
  modifiedAt,
  statusText,
  onChange,
  onSave,
}: {
  selectedPath: string | null;
  content: string;
  dirty: boolean;
  busy: boolean;
  canEdit: boolean;
  sizeBytes?: number;
  modifiedAt?: number;
  statusText?: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const modifiedLabel = modifiedAt
    ? new Date(modifiedAt).toLocaleString()
    : "n/a";
  const sizeLabel =
    typeof sizeBytes === "number" ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB` : "n/a";

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-bg-secondary">
      <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
        <p className="text-[11px] font-mono uppercase tracking-wide text-text-dim">
          editor://workspace
        </p>
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span>Size {sizeLabel}</span>
          <span>Modified {modifiedLabel}</span>
        </div>
      </div>
      <div className="p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input
          value={selectedPath ?? ""}
          readOnly
          placeholder="Select a file from the tree..."
          className="h-8 bg-bg-primary border-border-default text-text-primary text-xs font-mono"
        />
        <Button
          size="sm"
          className="h-8 gap-1.5 bg-accent-orange hover:bg-accent-orange/90 text-white"
          onClick={onSave}
          disabled={!selectedPath || !dirty || busy || !canEdit}
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        rows={16}
        className="bg-bg-primary border-border-default text-text-primary font-mono text-[12px]"
        placeholder="Open a text file to edit..."
        disabled={!selectedPath || busy || !canEdit}
      />
      {canEdit ? null : (
        <p className="mt-2 text-[11px] text-text-dim">
          Read-only: only workspace owner/admin can edit files.
        </p>
      )}
      {statusText ? <p className="mt-2 text-xs text-status-active">{statusText}</p> : null}
      </div>
    </div>
  );
}
