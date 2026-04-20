"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Timestamp } from "@/components/shared/Timestamp";
import { CommentForm } from "./CommentForm";
import { FileText, MessageSquare, Trash2 } from "lucide-react";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useState } from "react";

interface CommentThreadProps {
  taskId: Id<"tasks">;
}

type DocType = "deliverable" | "research" | "protocol" | "note";

export function CommentThread({ taskId }: CommentThreadProps) {
  const { workspaceId, canEdit, canManage } = useWorkspace();
  const messages = useQuery(api.messages.listWithAuthors, { workspaceId, taskId }) ?? [];
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const createDocument = useMutation(api.documents.create);
  const deleteMessage = useMutation(api.messages.remove);

  const [sourceMessage, setSourceMessage] = useState<Doc<"messages"> | null>(
    null,
  );
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<DocType>("note");
  const [docAgentId, setDocAgentId] = useState<string>("");
  const [docContent, setDocContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );

  const getAgentEmoji = (agentId: string | null) => {
    if (!agentId) return null;
    return agents.find((a) => a._id === agentId)?.emoji;
  };

  const getAuthorLabel = (msg: Doc<"messages">) => {
    const raw = (msg.authorName ?? "").trim();
    if (!msg.agentId) return raw;
    const agent = agents.find((a) => a._id === msg.agentId);
    if (!agent) return raw;
    const prefixed = `${agent.emoji} `;
    if (raw.startsWith(prefixed)) {
      return raw.slice(prefixed.length).trim() || agent.name;
    }
    return raw;
  };

  const getInitials = (name: string): string => {
    // Remove emoji prefix if present (e.g., "🧪 Friday" -> "Friday")
    const cleanName = name.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (!cleanName) return "U";

    const parts = cleanName.split(/\s+/);
    if (parts.length === 1) {
      return parts[0][0].toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const openDocModalFor = (msg: Doc<"messages">) => {
    setSourceMessage(msg);
    const firstLine = msg.content.split("\n")[0] ?? "";
    setDocTitle(firstLine.slice(0, 80) || "New document");
    setDocContent(msg.content);
    setDocType("note");
    const defaultAgentId =
      (msg.agentId as string | null) ??
      (agents.length > 0 ? (agents[0]._id as string) : "");
    setDocAgentId(defaultAgentId);
  };

  const closeDocModal = () => {
    if (isSaving) return;
    setSourceMessage(null);
    setDocTitle("");
    setDocContent("");
    setDocAgentId("");
  };

  const handleSaveDocument = async () => {
    if (!sourceMessage || !docAgentId) return;
    setIsSaving(true);
    try {
      await createDocument({
        workspaceId,
        title: docTitle.trim() || "New document",
        content: docContent,
        type: docType,
        taskId,
        agentId: docAgentId as Id<"agents">,
      });
      closeDocModal();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteComment = async (messageId: Id<"messages">) => {
    if (!canManage || deletingMessageId) return;
    const confirmed = window.confirm(
      "Delete this comment?\n\nThis action cannot be undone.",
    );
    if (!confirmed) return;
    setDeletingMessageId(messageId);
    try {
      await deleteMessage({ workspaceId, id: messageId });
    } finally {
      setDeletingMessageId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default">
        <MessageSquare className="h-4 w-4 text-text-secondary" />
        <h3 className="text-sm font-semibold text-text-primary">
          Comments ({messages.length})
        </h3>
      </div>
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No comments yet"
            description="Start the discussion"
          />
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const agentEmoji = getAgentEmoji(msg.agentId);
              const authorLabel = getAuthorLabel(msg as Doc<"messages">);
              const initials = getInitials(authorLabel);
              const hasUserImage = !agentEmoji && (msg as any).authorImage;

              return (
                <div key={msg._id} className="flex gap-2.5 sm:gap-3">
                  <div className="relative h-7 w-7 shrink-0">
                    {hasUserImage ? (
                      <img
                        src={(msg as any).authorImage}
                        alt={authorLabel}
                        className="h-full w-full rounded-full object-cover"
                        onError={(e) => {
                          // Fallback to initials on error
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    {(!hasUserImage || agentEmoji) && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-sm">
                        {agentEmoji ?? initials}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {authorLabel}
                        </span>
                        <Timestamp time={msg.createdAt} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {canEdit && (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-text-muted hover:text-text-secondary gap-1"
                            onClick={() =>
                              openDocModalFor(msg as Doc<"messages">)
                            }
                          >
                            <FileText className="h-3 w-3" />
                            Save as doc
                          </Button>
                        )}
                        {canManage ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-text-muted hover:text-status-blocked gap-1"
                            disabled={Boolean(deletingMessageId)}
                            onClick={() =>
                              void handleDeleteComment(msg._id as Id<"messages">)
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                            {deletingMessageId === msg._id
                              ? "Deleting..."
                              : "Delete"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1 min-w-0 max-w-full overflow-x-hidden text-sm text-text-secondary leading-relaxed">
                      <MarkdownContent content={msg.content} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      <div className="border-t border-border-default p-4">
        <CommentForm taskId={taskId} />
      </div>

      {canEdit && sourceMessage && (
        <Dialog
          open={!!sourceMessage}
          onOpenChange={(open) => !open && closeDocModal()}
        >
          <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[520px] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
              <DialogTitle className="text-text-primary flex items-center gap-2">
                <FileText className="h-4 w-4 text-text-secondary" />
                Save comment as document
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 min-h-0 overflow-y-auto px-6">
              <div className="space-y-4 pr-3 pb-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Title
                  </p>
                  <Input
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
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
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    rows={6}
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="shrink-0 px-6 pt-4 pb-6 border-t border-border-default">
              <Button
                type="button"
                variant="outline"
                onClick={closeDocModal}
                className="border-border-default text-text-secondary"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveDocument}
                disabled={!docAgentId || isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
