"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Timestamp } from "@/components/shared/Timestamp";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText } from "lucide-react";
import { useState } from "react";
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

const DOC_TYPES = [
  { value: undefined, label: "All" },
  { value: "deliverable" as const, label: "Deliverables" },
  { value: "research" as const, label: "Research" },
  { value: "protocol" as const, label: "Protocols" },
  { value: "note" as const, label: "Notes" },
];

const typeColors: Record<string, string> = {
  deliverable: "bg-status-active/20 text-status-active",
  research: "bg-status-review/20 text-status-review",
  protocol: "bg-accent-orange/20 text-accent-orange",
  note: "bg-teal/20 text-teal",
};

type DocType = "deliverable" | "research" | "protocol" | "note";

function DocumentsContent() {
  const { workspaceId, canEdit } = useWorkspace();
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const docs = useQuery(api.documents.list, { workspaceId, type: filterType as any }) ?? [];
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const createDocument = useMutation(api.documents.create);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<DocType>("note");
  const [docAgentId, setDocAgentId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const getAgent = (id: string) => agents.find((a) => a._id === id);

  const openCreate = () => {
    setShowCreate(true);
    setTitle("");
    setContent("");
    setDocType("note");
    setDocAgentId(agents.length > 0 ? (agents[0]._id as string) : "");
  };

  const closeCreate = () => {
    if (isSaving) return;
    setShowCreate(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !docAgentId) return;
    setIsSaving(true);
    try {
      await createDocument({
        workspaceId,
        title: title.trim(),
        content,
        type: docType,
        taskId: null,
        agentId: docAgentId as any,
      });
      setShowCreate(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-orange/20">
            <FileText className="h-4 w-4 text-accent-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Documents</h1>
            <p className="text-xs text-text-muted">
              Agent-produced deliverables & research
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="bg-accent-orange hover:bg-accent-orange/90 text-white text-xs"
            onClick={openCreate}
          >
            New document
          </Button>
        )}
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {DOC_TYPES.map((t) => (
          <button key={t.label} onClick={() => setFilterType(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-smooth border ${filterType === t.value ? "bg-accent-orange/20 border-accent-orange text-accent-orange" : "bg-bg-secondary border-border-default text-text-secondary hover:border-border-hover"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Documents will appear as agents produce deliverables"
        />
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const agent = getAgent(doc.agentId);
            return (
              <div
                key={doc._id}
                className="rounded-xl border border-border-default bg-bg-secondary p-5 transition-smooth hover:border-border-hover"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary truncate">
                        {doc.title}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          typeColors[doc.type] ??
                          "bg-bg-tertiary text-text-muted"
                        }`}
                      >
                        {doc.type}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-text-secondary line-clamp-2">
                      {doc.content}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      {agent && (
                        <span className="text-xs text-text-muted">
                          {agent.emoji} {agent.name}
                        </span>
                      )}
                      <Timestamp time={doc.createdAt} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <Dialog open={showCreate} onOpenChange={(open) => !open && closeCreate()}>
          <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="text-text-primary flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent-orange" />
                New document
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Type
                </p>
                <Select
                  value={docType}
                  onValueChange={(v) => setDocType(v as DocType)}
                >
                  <SelectTrigger className="bg-bg-primary border-border-default text-text-primary h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-default text-xs">
                    <SelectItem value="deliverable">Deliverable</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="protocol">Protocol</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Attribute to agent
                </p>
                <Select
                  value={docAgentId}
                  onValueChange={(v) => setDocAgentId(v)}
                >
                  <SelectTrigger className="bg-bg-primary border-border-default text-text-primary h-8 text-xs">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-default text-xs">
                    {agents.map((agent) => (
                      <SelectItem key={agent._id} value={agent._id}>
                        {agent.emoji} {agent.name} — {agent.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Content (Markdown)
                </p>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCreate}
                className="border-border-default text-text-secondary"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!title.trim() || !docAgentId || isSaving}
                className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              >
                {isSaving ? "Saving..." : "Save document"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return <AppLayout><DocumentsContent /></AppLayout>;
}
