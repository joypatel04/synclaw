"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { Timestamp } from "@/components/shared/Timestamp";
import { CommentThread } from "./CommentThread";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TaskDetailProps { taskId: Id<"tasks">; }

export function TaskDetail({ taskId }: TaskDetailProps) {
  const { workspaceId, canEdit, canManage } = useWorkspace();
  const task = useQuery(api.tasks.getById, { workspaceId, id: taskId });
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const updateTask = useMutation(api.tasks.update);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const deleteTask = useMutation(api.tasks.remove);
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (task === undefined) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" /></div>;
  if (task === null) return <div className="flex flex-col items-center justify-center py-20 text-center"><p className="text-text-muted">Task not found</p><Link href="/" className="mt-2 text-sm text-accent-orange hover:underline">Back to dashboard</Link></div>;

  const assignees = agents.filter((a) => task.assigneeIds.includes(a._id as Id<"agents">));

  const handleStatusChange = async (status: string) => { await updateStatus({ workspaceId, id: taskId, status: status as any }); };
  const handlePriorityChange = async (priority: string) => { await updateTask({ workspaceId, id: taskId, priority: priority as any }); };
  const handleDelete = async () => { await deleteTask({ workspaceId, id: taskId }); router.push("/"); };

  const toggleAssignee = (agentId: Id<"agents">) => {
    const next = task.assigneeIds.includes(agentId)
      ? task.assigneeIds.filter((id) => id !== agentId)
      : [...task.assigneeIds, agentId];
    void updateTask({ workspaceId, id: taskId, assigneeIds: next });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-smooth mb-6"><ArrowLeft className="h-4 w-4" />Back to dashboard</Link>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-text-primary">{task.title}</h1>
            <div className="flex items-center gap-2 shrink-0"><PriorityBadge priority={task.priority} /><StatusBadge status={task.status} /></div>
          </div>
          {task.description && (
            <div className="mt-4 text-sm text-text-secondary leading-relaxed">
              <MarkdownContent content={task.description} />
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border-default bg-bg-secondary p-4">
            <div>
              <p className="text-xs text-text-muted mb-1.5">Status</p>
              {canEdit ? (
                <Select value={task.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="bg-bg-primary border-border-default text-text-primary h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-default">
                    {["inbox","assigned","in_progress","review","done","blocked"].map((s) => <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g," ").toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <StatusBadge status={task.status} />}
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1.5">Priority</p>
              {canEdit ? (
                <Select value={task.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="bg-bg-primary border-border-default text-text-primary h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-default">
                    {["high","medium","low","none"].map((p) => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <PriorityBadge priority={task.priority} />}
            </div>
            <div><p className="text-xs text-text-muted mb-1.5">Created by</p><p className="text-sm text-text-primary">{task.createdBy}</p></div>
            <div><p className="text-xs text-text-muted mb-1.5">Created</p><Timestamp time={task.createdAt} showFull /></div>
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Assignees</h3>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => {
                  const isAssigned = task.assigneeIds.includes(agent._id as Id<"agents">);
                  return (
                    <button
                      key={agent._id}
                      type="button"
                      onClick={() => toggleAssignee(agent._id as Id<"agents">)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-smooth ${
                        isAssigned
                          ? "bg-accent-orange/20 border-accent-orange text-accent-orange"
                          : "bg-bg-primary border-border-default text-text-secondary hover:border-border-hover"
                      }`}
                    >
                      <AgentAvatar emoji={agent.emoji} name={agent.name} size="sm" status={agent.status} />
                      <div>
                        <p className="text-xs font-medium">{agent.name}</p>
                        <p className="text-[10px] opacity-80">{agent.role}</p>
                      </div>
                    </button>
                  );
                })}
                {agents.length === 0 && <p className="text-xs text-text-dim">No agents in workspace. Add agents on the Agents page.</p>}
              </div>
            ) : assignees.length === 0 ? (
              <p className="text-xs text-text-dim">No agents assigned</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignees.map((agent) => (
                  <div key={agent._id} className="flex items-center gap-2 rounded-lg bg-bg-secondary border border-border-default px-3 py-2">
                    <AgentAvatar emoji={agent.emoji} name={agent.name} size="sm" status={agent.status} />
                    <div><p className="text-xs font-medium text-text-primary">{agent.name}</p><p className="text-[10px] text-text-muted">{agent.role}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canManage && (
            <div className="mt-8 border-t border-border-default pt-6">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-3 rounded-lg bg-status-blocked/10 border border-status-blocked/30 p-4">
                  <p className="text-sm text-text-primary flex-1">Are you sure you want to delete this task?</p>
                  <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)} className="border-border-default text-text-secondary">Cancel</Button>
                  <Button size="sm" onClick={handleDelete} className="bg-status-blocked hover:bg-status-blocked/90 text-white">Delete</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(true)} className="border-status-blocked/30 text-status-blocked hover:bg-status-blocked/10"><Trash2 className="h-4 w-4 mr-1.5" />Delete Task</Button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="w-full lg:w-[400px] border-t lg:border-t-0 lg:border-l border-border-default bg-bg-secondary"><CommentThread taskId={taskId} /></div>
    </div>
  );
}
