"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { CreateTaskModal } from "@/components/task/CreateTaskModal";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { KanbanColumn } from "./KanbanColumn";

type TaskStatus =
  | "inbox"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "review"
  | "done";

const columns: { id: TaskStatus; title: string }[] = [
  { id: "inbox", title: "Inbox" },
  { id: "assigned", title: "Assigned" },
  { id: "in_progress", title: "In Progress" },
  { id: "blocked", title: "Blocked" },
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

  const handleDragEnd = (result: DropResult) => {
    if (!canEdit) return;
    const { destination, draggableId } = result;
    if (!destination) return;
    const destinationStatus = columns.find(
      (col) => col.id === destination.droppableId,
    );
    if (!destinationStatus) return;
    void updateStatus({
      workspaceId,
      id: draggableId as any,
      status: destinationStatus.id,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between border-b border-border-default/70 px-1 pb-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
            Control Board
          </p>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">
            Tasks
          </h2>
        </div>
        {canEdit && (
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="scrollbar-none flex min-h-0 flex-1 gap-2.5 overflow-x-auto pb-2">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              isBlockedColumn={col.id === "blocked"}
              tasks={tasksByStatus[col.id] ?? []}
              agents={agents}
            />
          ))}
        </div>
      </DragDropContext>

      <CreateTaskModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        agents={agents}
      />
    </div>
  );
}
