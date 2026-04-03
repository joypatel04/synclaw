"use client";

import { useMutation, useQuery } from "convex/react";
import {
  FileText,
  Folder,
  FolderPlus,
  FolderTree,
  Globe,
  Pencil,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Timestamp } from "@/components/shared/Timestamp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("docId");

  const [docTypeFilter, setDocTypeFilter] = useState<"all" | DocType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedFolderId, setSelectedFolderId] =
    useState<Id<"folders"> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editingDocumentId, setEditingDocumentId] =
    useState<Id<"documents"> | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<DocType>("note");
  const [docStatus, setDocStatus] = useState<DocStatus>("draft");
  const [docAgentId, setDocAgentId] = useState<string>("");
  const [docFolderId, setDocFolderId] = useState<string>("__none__");
  const [isGlobalContext, setIsGlobalContext] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const documents =
    useQuery(api.documents.list, {
      workspaceId,
      type: docTypeFilter === "all" ? undefined : docTypeFilter,
      isGlobalContext: viewMode === "global" ? true : undefined,
      onlyDrafts: viewMode === "drafts" ? true : undefined,
      folderId:
        viewMode === "folder" && selectedFolderId
          ? selectedFolderId
          : undefined,
    }) ?? [];

  const deepLinkedDoc = useQuery(
    api.documents.getById,
    docIdParam ? { workspaceId, id: docIdParam as Id<"documents"> } : "skip",
  );

  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const folders = useQuery(api.folders.list, { workspaceId }) ?? [];
  const upsertDocument = useMutation(api.documents.upsertDocument);
  const createFolder = useMutation(api.folders.create);

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
    // If this editor was opened via deep-link, clear the URL so it doesn't reopen.
    if (docIdParam) router.replace("/documents");
  };

  const handleSave = async () => {
    if (!canEdit) return;
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
        folderId:
          docFolderId === "__none__"
            ? undefined
            : (docFolderId as Id<"folders">),
        agentId: docAgentId as Id<"agents">,
        isGlobalContext,
      });
      setShowEditor(false);
      resetEditor();
    } finally {
      setIsSaving(false);
    }
  };

  // Deep-link support: /documents?docId=<id>
  useEffect(() => {
    if (!docIdParam) return;
    if (!deepLinkedDoc) return;
    // Avoid re-opening if we're already editing this doc.
    if (editingDocumentId === deepLinkedDoc._id && showEditor) return;

    // Ensure the target doc is visible regardless of current filters.
    setDocTypeFilter("all");
    setViewMode("all");
    setSelectedFolderId(null);
    setSidebarOpen(false);
    openEdit(deepLinkedDoc as any);
  }, [docIdParam, deepLinkedDoc, editingDocumentId, showEditor]);

  const handleCreateFolder = async () => {
    if (!canEdit || isCreatingFolder) return;
    const name = window.prompt("Folder name");
    if (!name || !name.trim()) return;

    setIsCreatingFolder(true);
    try {
      const folderId = await createFolder({
        workspaceId,
        name: name.trim(),
      });
      setDocFolderId(String(folderId));
      setViewMode("folder");
      setSelectedFolderId(folderId);
    } finally {
      setIsCreatingFolder(false);
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

  const sidebar = (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
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
            setSidebarOpen(false);
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
            setSidebarOpen(false);
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
            setSidebarOpen(false);
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
    </div>
  );

  return (
    <div className="app-page-wide">
      <div className="app-page-header flex-col sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-orange/30 bg-accent-orange/20">
            <FileText className="h-4 w-4 text-accent-orange" />
          </div>
          <div>
            <h1 className="app-page-title">Documents</h1>
            <p className="app-page-subtitle hidden sm:block">
              Shared Brain: intelligence, protocols, and agent outputs
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs lg:hidden"
              >
                <FolderTree className="mr-2 h-3.5 w-3.5" />
                Browse
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-bg-secondary border-border-default p-0"
            >
              <SheetHeader className="border-b border-border-default">
                <SheetTitle className="text-text-primary text-sm">
                  Documents
                </SheetTitle>
              </SheetHeader>
              <div className="p-4">{sidebar}</div>
            </SheetContent>
          </Sheet>

          {canEdit && (
            <Button
              size="sm"
              className="h-8 bg-accent-orange px-3 text-xs text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)] hover:bg-accent-orange/90 sm:h-9 sm:px-4"
              onClick={openCreate}
            >
              New document
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">{sidebar}</aside>

        <main className="order-1 lg:order-none">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
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
                    className="rounded-2xl border border-border-default/80 bg-[linear-gradient(165deg,var(--cw-bg-secondary),color-mix(in_oklab,var(--cw-bg-tertiary)_80%,transparent))] p-3 shadow-[0_12px_28px_rgba(2,8,24,0.24)] transition-smooth hover:-translate-y-0.5 hover:border-border-hover sm:p-5"
                  >
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
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

                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-muted sm:mt-4 sm:text-xs">
                      <span className="rounded bg-bg-primary/60 px-1.5 py-0.5">
                        v{doc.version ?? 1}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="truncate max-w-full">
                        Created by{" "}
                        {createdBy
                          ? `${createdBy.emoji} ${createdBy.name}`
                          : "Unknown"}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="truncate max-w-full">
                        Edited by{" "}
                        {editedBy
                          ? `${editedBy.emoji} ${editedBy.name}`
                          : "Unknown"}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <Timestamp time={doc.updatedAt ?? doc.createdAt} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <Dialog open={showEditor} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle className="text-text-primary flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent-orange" />
              {editingDocumentId
                ? canEdit
                  ? "Edit document"
                  : "View document"
                : "New document"}
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
                  disabled={!canEdit}
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim disabled:opacity-70"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Type
                  </p>
                  <Select
                    value={docType}
                    onValueChange={(v) => setDocType(v as DocType)}
                  >
                    <SelectTrigger
                      disabled={!canEdit}
                      className="bg-bg-primary border-border-default text-text-primary h-8 text-xs disabled:opacity-70"
                    >
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
                  <Select
                    value={docStatus}
                    onValueChange={(v) => setDocStatus(v as DocStatus)}
                  >
                    <SelectTrigger
                      disabled={!canEdit}
                      className="bg-bg-primary border-border-default text-text-primary h-8 text-xs disabled:opacity-70"
                    >
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
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Folder
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCreateFolder}
                      className="h-6 px-2 text-[11px] text-accent-orange hover:bg-accent-orange/10 hover:text-accent-orange"
                      disabled={!canEdit || isCreatingFolder}
                    >
                      <FolderPlus className="mr-1 h-3 w-3" />
                      {isCreatingFolder ? "Creating..." : "New"}
                    </Button>
                  </div>
                  <Select value={docFolderId} onValueChange={setDocFolderId}>
                    <SelectTrigger
                      disabled={!canEdit}
                      className="bg-bg-primary border-border-default text-text-primary h-8 text-xs disabled:opacity-70"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-bg-tertiary border-border-default text-xs">
                      <SelectItem value="__none__">No folder</SelectItem>
                      {folders.map((folder) => (
                        <SelectItem key={folder._id} value={String(folder._id)}>
                          {folder.icon ? `${folder.icon} ` : ""}
                          {folder.name}
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
                    <SelectTrigger
                      disabled={!canEdit}
                      className="bg-bg-primary border-border-default text-text-primary h-8 text-xs disabled:opacity-70"
                    >
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
                  disabled={!canEdit}
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
                  disabled={!canEdit}
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim disabled:opacity-70"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="shrink-0 border-t border-border-default px-6 pb-6 pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeEditor}
              className="border-border-default text-text-secondary"
              disabled={isSaving}
            >
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit && (
              <Button
                type="button"
                onClick={handleSave}
                disabled={!title.trim() || !docAgentId || isSaving}
                className="bg-accent-orange text-white hover:bg-accent-orange/90"
              >
                {isSaving
                  ? "Saving..."
                  : editingDocumentId
                    ? "Save changes"
                    : "Save document"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
