"use client";

import { Droppable, Draggable } from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Doc<"tasks">[];
  agents: Doc<"agents">[];
  isBlockedColumn?: boolean;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  agents,
  isBlockedColumn = false,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        "flex min-w-[220px] flex-1 flex-col rounded-2xl border border-border-default/75 bg-bg-secondary/68",
        isBlockedColumn &&
          "border-status-blocked/35 bg-status-blocked/5",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border-default/60 px-3 py-2.5">
        <h3
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wider text-text-secondary",
            isBlockedColumn && "text-status-blocked",
          )}
        >
          {title}
        </h3>
        <span
          className={cn(
            "flex h-5 min-w-[20px] items-center justify-center rounded-full bg-bg-tertiary px-1.5 text-[10px] font-mono font-medium text-text-muted",
            isBlockedColumn && "bg-status-blocked/15 text-status-blocked",
          )}
        >
          {tasks.length}
        </span>
      </div>

      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "scrollbar-none min-h-[80px] flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-smooth",
              snapshot.isDraggingOver &&
                "rounded-b-2xl bg-accent-orange/8",
            )}
          >
            {tasks.map((task, index) => (
              <Draggable
                key={task._id}
                draggableId={task._id}
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <TaskCard
                      task={task}
                      agents={agents}
                      isDragging={snapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
