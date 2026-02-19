"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Copy, Download, FileText, Save } from "lucide-react";

type FileHandle = any;

function supportsFileSystemAccessApi(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as any).showOpenFilePicker === "function";
}

export function LocalOpenClawConfigEditor() {
  const canUseFs = useMemo(() => supportsFileSystemAccessApi(), []);
  const [fileHandle, setFileHandle] = useState<FileHandle | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openFile = async () => {
    setError(null);
    if (!canUseFs) {
      setError(
        "Your browser does not support the File System Access API. Use copy/paste mode instead (Chrome/Edge recommended).",
      );
      return;
    }

    setBusy(true);
    try {
      const picker: any = (window as any).showOpenFilePicker;
      const handles: FileHandle[] = await picker({
        multiple: false,
        excludeAcceptAllOption: false,
        types: [
          {
            description: "OpenClaw config",
            accept: {
              "application/json": [".json"],
              "text/plain": [".yaml", ".yml", ".toml", ".env", ".txt"],
            },
          },
        ],
      });
      const handle = handles?.[0];
      if (!handle) return;
      const file = await handle.getFile();
      const text = await file.text();
      setFileHandle(handle);
      setFileName(file.name);
      setContent(text);
      setDirty(false);
    } catch (e) {
      // User cancel is common; keep it quiet.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes("abort")) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const saveFile = async () => {
    setError(null);
    if (!fileHandle) {
      setError("No file selected yet.");
      return;
    }
    setBusy(true);
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const download = () => {
    setError(null);
    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "openclaw.config.txt";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const formatJson = () => {
    setError(null);
    try {
      const parsed = JSON.parse(content);
      const next = JSON.stringify(parsed, null, 2) + "\n";
      setContent(next);
      setDirty(true);
    } catch (e) {
      setError("Not valid JSON. (YAML/TOML formatting is not supported yet.)");
    }
  };

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">
              OpenClaw config file (local)
            </h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            View and edit the actual OpenClaw config file in your repo on this
            machine. Nothing is uploaded to Sutraha HQ.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => void openFile()}
          disabled={busy}
        >
          {busy ? "Opening..." : "Open file"}
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-dim">
          File:{" "}
          <span className="font-mono text-text-muted">
            {fileName ?? "(none selected)"}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={formatJson}
            disabled={busy || !content.trim()}
            title="Formats JSON only"
          >
            Format JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={download}
            disabled={busy || !content.trim()}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => void copy()}
            disabled={busy || !content.trim()}
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-status-active" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            className="h-8 gap-2 bg-accent-orange hover:bg-accent-orange/90 text-white"
            onClick={() => void saveFile()}
            disabled={busy || !fileHandle || !dirty}
            title={!fileHandle ? "Open a file first" : dirty ? "Save to disk" : "No changes"}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        placeholder={
          canUseFs
            ? "Open a file to view/edit it here…"
            : "Paste your OpenClaw config content here (Chrome/Edge recommended for direct file editing)…"
        }
        rows={12}
        className="mt-3 bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
      />

      {error ? (
        <p className="mt-2 text-xs text-status-blocked">{error}</p>
      ) : null}

      {!canUseFs ? (
        <p className="mt-2 text-[11px] text-text-dim">
          Tip: Direct editing requires the File System Access API (best on
          Chrome/Edge, works on HTTPS or localhost).
        </p>
      ) : null}
    </div>
  );
}

