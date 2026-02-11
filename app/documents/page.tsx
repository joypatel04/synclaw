"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Timestamp } from "@/components/shared/Timestamp";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Folder, FolderTree, Globe, Pencil } from "lucide-react";

type DocType = "deliverable" | "research" | "protocol" | "note" | "journal";
type DocStatus = "draft" | "final" | "archived";
type ViewMode = "all" | "global" | "drafts" | "folder";

const DOC_TYPES: Array<{ value: "all" | DocType; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "deliverable", label: "Deliverables" },
  { value: "research", label: "Research" },
  { value: "protocol", label: "Protocols" },
  { value: "note", label: "Notes" },
  { value: "journal", label: "Journals" },
];

const typeColors: Record<DocType, string> = {
  deliverable: "bg-status-active/20 text-status-active",
  research: "bg-status-review/20 text-status-review",
  protocol: "bg-accent-orange/20 text-accent-orange",
  note: "bg-teal/20 text-teal",
  journal: "bg-text-muted/20 text-text-muted",
};

const statusClasses: Record<DocStatus, string> = {
  draft: "bg-text-muted/20 text-text-muted",
  final: "bg-status-active/20 text-status-active",
  archived: "bg-text-dim/20 text-text-dim",
};

function DocumentsContent() {
  const { workspaceId, canEdit } = useWorkspace();
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | DocType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | null>(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<Id<"documents"> | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<DocType>("note");
  const [docStatus, setDocStatus] = useState<DocStatus>("draft");
  const [docAgentId, setDocAgentId] = useState<string>("");
  const [docFolderId, setDocFolderId] = useState<string>("__none__");
  const [isGlobalContext, setIsGlobalContext] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const documents = useQuery(api.documents.list, {
    workspaceId,
    type: docTypeFilter === "all" ? undefined : docTypeFilter,
    isGlobalContext: viewMode === "global" ? true : undefined,
    onlyDrafts: viewMode === "drafts" ? true : undefined,
    folderId: viewMode === "folder" && selectedFolderId ? selectedFolderId : undefined,
  }) ?? [];
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const folders = useQuery(api.folders.list, { workspaceId }) ?? [];
  const upsertDocument = useMutation(api.documents.upsertDocument);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof folders>();
    for (const folder of folders) {
      const key = folder.parentId ?? "__root__";
      const existing = map.get(key) ?? [];
      existing.push(folder);
      map.set(key, existing);
    }
    return map;
  }, [folders]);

  const agentById = useMemo(() => {
    return new Map(agents.map((agent) => [agent._id, agent] as const));
  }, [agents]);

  const resetEditor = () => {
    setEditingDocumentId(null);
    setTitle("");
    setContent("");
    setDocType("note");
    setDocStatus("draft");
    setDocFolderId("__none__");
    setIsGlobalContext(false);
    setDocAgentId(agents.length > 0 ? String(agents[0]._id) : "");
  };

  const openCreate = () => {
    resetEditor();
    setShowEditor(true);
  };

  const openEdit = (doc: (typeof documents)[number]) => {
    setEditingDocumentId(doc._id);
    setTitle(doc.title);
    setContent(doc.content);
    setDocType(doc.type);
    setDocStatus(doc.status ?? "draft");
    setDocAgentId(String(doc.lastEditedBy ?? doc.agentId));
    setDocFolderId(doc.folderId ? String(doc.folderId) : "__none__");
    setIsGlobalContext(doc.isGlobalContext ?? false);
    setShowEditor(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setShowEditor(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !docAgentId) return;
    setIsSaving(true);
    try {
      await upsertDocument({
        workspaceId,
        id: editingDocumentId ?? undefined,
        title: title.trim(),
        content,
        type: docType,
        status: docStatus,
        taskId: null,
        folderId: docFolderId === "__none__" ? undefined : (docFolderId as Id<"folders">),
        agentId: docAgentId as Id<"agents">,
        isGlobalContext,
      });
      setShowEditor(false);
      resetEditor();
    } finally {
      setIsSaving(false);
    }
  };

  const renderFolderTree = (parentId?: Id<"folders">, depth = 0) => {
    const key = parentId ?? "__root__";
    const folderNodes = childrenByParent.get(key) ?? [];
    return folderNodes.map((folder) => {
      const selected = viewMode === "folder" && selectedFolderId === folder._id;
      return (
        <div key={folder._id}>
          <button
            type="button"
            onClick={() => {
              setViewMode("folder");
              setSelectedFolderId(folder._id);
            }}
            className={cn(
              "w-full rounded-md px-2 py-1.5 text-left text-xs transition-smooth",
              selected
                ? "bg-accent-orange/20 text-accent-orange"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
            )}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5" />
              {folder.icon ? `${folder.icon} ` : ""}
              {folder.name}
            </span>
          </button>
          {renderFolderTree(folder._id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-orange/20">
            <FileText className="h-4 w-4 text-accent-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Documents</h1>
            <p className="text-xs text-text-muted">
              Shared Brain: intelligence, protocols, and agent outputs
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="bg-accent-orange text-white hover:bg-accent-orange/90 text-xs"
            onClick={openCreate}
          >
            New document
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-border-default bg-bg-secondary p-4">
          <div className="mb-4 flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-text-muted" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Knowledge Sidebar
            </h2>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setViewMode("all");
                setSelectedFolderId(null);
              }}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-xs transition-smooth",
                viewMode === "all"
                  ? "bg-accent-orange/20 text-accent-orange"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              All Documents
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("global");
                setSelectedFolderId(null);
              }}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-xs transition-smooth",
                viewMode === "global"
                  ? "bg-accent-orange/20 text-accent-orange"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              🌍 Global Context
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("drafts");
                setSelectedFolderId(null);
              }}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-xs transition-smooth",
                viewMode === "drafts"
                  ? "bg-accent-orange/20 text-accent-orange"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              📝 Drafts
            </button>
          </div>

          <div className="my-4 border-t border-border-default" />
          <div className="space-y-1">{renderFolderTree()}</div>
        </aside>

        <main>
          <div className="mb-4 flex gap-2 overflow-x-auto">
            {DOC_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setDocTypeFilter(t.value)}
                className={cn(
                  "whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-smooth",
                  docTypeFilter === t.value
                    ? "border-accent-orange bg-accent-orange/20 text-accent-orange"
                    : "border-border-default bg-bg-secondary text-text-secondary hover:border-border-hover",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Create docs, mark global context, and organize them by folder."
            />
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const docStatus = doc.status ?? "draft";
                const createdBy = agentById.get(doc.agentId);
                const editedBy = doc.lastEditedBy
                  ? agentById.get(doc.lastEditedBy)
                  : undefined;
                return (
                  <div
                    key={doc._id}
                    className="rounded-xl border border-border-default bg-bg-secondary p-5 transition-smooth hover:border-border-hover"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-text-primary">
                            {doc.isGlobalContext && (
                              <Globe className="mr-1 inline h-3.5 w-3.5 text-accent-orange" />
                            )}
                            {doc.title}
                          </h3>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              typeColors[doc.type],
                            )}
                          >
                            {doc.type}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-text-secondary">
                          {doc.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            statusClasses[docStatus],
                          )}
                        >
                          {docStatus}
                        </span>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                            onClick={() => openEdit(doc)}
                            title="Edit document"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span>v{doc.version ?? 1}</span>
                      <span>•</span>
                      <span>
                        Created by {createdBy ? `${createdBy.emoji} ${createdBy.name}` : "Unknown"}
                      </span>
                      <span>•</span>
                      <span>
                        Edited by {editedBy ? `${editedBy.emoji} ${editedBy.name}` : "Unknown"}
                      </span>
                      <span>•</span>
                      <Timestamp time={doc.updatedAt ?? doc.createdAt} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {canEdit && (
        <Dialog open={showEditor} onOpenChange={(open) => !open && closeEditor()}>
          <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
              <DialogTitle className="text-text-primary flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent-orange" />
                {editingDocumentId ? "Edit document" : "New document"}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="min-h-0 flex-1 overflow-y-auto px-6">
              <div className="space-y-4 pb-4 pr-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Title
                  </p>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Document title"
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Type
                    </p>
                    <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                      <SelectTrigger className="bg-bg-primary border-border-default text-text-primary h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-bg-tertiary border-border-default text-xs">
                        <SelectItem value="deliverable">Deliverable</SelectItem>
                        <SelectItem value="research">Research</SelectItem>
                        <SelectItem value="protocol">Protocol</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="journal">Journal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Status
                    </p>
                    <Select value={docStatus} onValueChange={(v) => setDocStatus(v as DocStatus)}>
                      <SelectTrigger className="bg-bg-primary border-border-default text-text-primary h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-bg-tertiary border-border-default text-xs">
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Folder
                    </p>
                    <Select value={docFolderId} onValueChange={setDocFolderId}>
                      <SelectTrigger className="bg-bg-primary border-border-default text-text-primary h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-bg-tertiary border-border-default text-xs">
                        <SelectItem value="__none__">No folder</SelectItem>
                        {folders.map((folder) => (
                          <SelectItem key={folder._id} value={folder._id}>
                            {folder.icon ? `${folder.icon} ` : ""}{folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Edited by
                    </p>
                    <Select value={docAgentId} onValueChange={setDocAgentId}>
                      <SelectTrigger className="bg-bg-primary border-border-default text-text-primary h-8 text-xs">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent className="bg-bg-tertiary border-border-default text-xs">
                        {agents.map((agent) => (
                          <SelectItem key={agent._id} value={agent._id}>
                            {agent.emoji} {agent.name} - {agent.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={isGlobalContext}
                    onChange={(e) => setIsGlobalContext(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border-default bg-bg-primary"
                  />
                  Global Context (inject into all agent runs)
                </label>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Content (Markdown)
                  </p>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="shrink-0 border-t border-border-default px-6 pb-6 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditor}
                className="border-border-default text-text-secondary"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!title.trim() || !docAgentId || isSaving}
                className="bg-accent-orange text-white hover:bg-accent-orange/90"
              >
                {isSaving ? "Saving..." : editingDocumentId ? "Save changes" : "Save document"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <AppLayout>
      <DocumentsContent />
    </AppLayout>
  );
}
