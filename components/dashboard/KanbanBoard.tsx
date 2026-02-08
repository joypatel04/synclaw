"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { KanbanColumn } from "./KanbanColumn";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CreateTaskModal } from "@/components/task/CreateTaskModal";

type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";

const columns: { id: TaskStatus; title: string }[] = [
  { id: "inbox", title: "Inbox" },
  { id: "assigned", title: "Assigned" },
  { id: "in_progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

export function KanbanBoard() {
  const { workspaceId, canEdit } = useWorkspace();
  const tasks = useQuery(api.tasks.list, { workspaceId }) ?? [];
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const updateStatus = useMutation(api.tasks.updateStatus);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const tasksByStatus = columns.reduce(
    (acc, col) => {
      acc[col.id] = tasks.filter((t) => t.status === col.id);
      return acc;
    },
    {} as Record<TaskStatus, typeof tasks>,
  );
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  const handleDragEnd = (result: DropResult) => {
    if (!canEdit) return;
    const { destination, draggableId } = result;
    if (!destination) return;
    void updateStatus({
      workspaceId,
      id: draggableId as any,
      status: destination.droppableId as TaskStatus,
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Tasks</h2>
        {canEdit && (
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="bg-accent-orange hover:bg-accent-orange/90 text-white gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={tasksByStatus[col.id] ?? []}
              agents={agents}
            />
          ))}
        </div>
      </DragDropContext>

      {blockedTasks.length > 0 && (
        <div className="mt-4 rounded-xl border border-status-blocked/30 bg-status-blocked/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-status-blocked mb-3">
            Blocked ({blockedTasks.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {blockedTasks.map((task) => (
              <div key={task._id} className="rounded-lg bg-bg-secondary border border-border-default p-3">
                <p className="text-sm text-text-primary">{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <CreateTaskModal open={showCreateModal} onOpenChange={setShowCreateModal} agents={agents} />
    </div>
  );
}
