"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function FilesystemEditor({
  selectedPath,
  content,
  selectedMime,
  selectedEncoding,
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
  selectedMime?: string | null;
  selectedEncoding?: "utf8" | "base64" | string;
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
    typeof sizeBytes === "number"
      ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
      : "n/a";
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const ext = useMemo(() => {
    if (!selectedPath) return "";
    const i = selectedPath.lastIndexOf(".");
    return i >= 0 ? selectedPath.slice(i).toLowerCase() : "";
  }, [selectedPath]);
  const canPreviewMarkdown = ext === ".md" || ext === ".markdown";
  const isPdf =
    selectedMime === "application/pdf" ||
    ext === ".pdf" ||
    selectedEncoding === "base64";
  const pdfDataUrl = useMemo(() => {
    if (!isPdf || !content) return null;
    return `data:application/pdf;base64,${content}`;
  }, [isPdf, content]);

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-bg-secondary">
      <div className="flex flex-col gap-1 border-b border-border-default px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-mono uppercase tracking-wide text-text-dim">
          editor://workspace
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
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
            className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={onSave}
            disabled={!selectedPath || !dirty || busy || !canEdit || isPdf}
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          <div className="ml-auto inline-flex items-center gap-1 rounded-md border border-border-default bg-bg-primary p-1">
            <button
              type="button"
              className={cnTab(tab === "edit")}
              onClick={() => setTab("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              className={cnTab(tab === "preview")}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
          </div>
        </div>
        {isPdf ? (
          <div className="space-y-2">
            <div className="rounded-md border border-border-default bg-bg-primary p-2">
              <p className="text-xs text-text-muted">
                PDF preview is read-only.
              </p>
            </div>
            {pdfDataUrl ? (
              <iframe
                src={pdfDataUrl}
                title={selectedPath ?? "PDF preview"}
                className="h-[70vh] w-full rounded-md border border-border-default bg-bg-primary"
              />
            ) : (
              <div className="min-h-[240px] rounded-md border border-border-default bg-bg-primary p-4 text-sm text-text-dim">
                Open a PDF file to preview.
              </div>
            )}
          </div>
        ) : tab === "edit" ? (
          <Textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            rows={18}
            className="bg-bg-primary border-border-default text-text-primary font-mono text-[12px]"
            placeholder="Open a text file to edit..."
            disabled={!selectedPath || busy || !canEdit}
          />
        ) : (
          <div className="min-h-[420px] rounded-md border border-border-default bg-bg-primary p-4 text-sm">
            {!selectedPath ? (
              <p className="text-text-dim">Open a file to preview.</p>
            ) : canPreviewMarkdown ? (
              <div className="space-y-3 text-text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-6 text-text-secondary">
                {content}
              </pre>
            )}
          </div>
        )}
        {canEdit ? null : (
          <p className="mt-2 text-[11px] text-text-dim">
            Read-only: only workspace owner/admin can edit files.
          </p>
        )}
        {statusText ? (
          <p className="mt-2 text-xs text-status-active">{statusText}</p>
        ) : null}
      </div>
    </div>
  );
}

function cnTab(active: boolean): string {
  return active
    ? "rounded px-2 py-1 text-[11px] font-medium text-text-secondary"
    : "rounded px-2 py-1 text-[11px] text-text-muted hover:text-text-primary";
}
