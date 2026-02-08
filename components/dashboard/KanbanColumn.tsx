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
}

export function KanbanColumn({
  id,
  title,
  tasks,
  agents,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-1 min-w-[200px] flex-col rounded-xl bg-bg-primary/50 border border-border-default">
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          {title}
        </h3>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-bg-tertiary px-1.5 text-[10px] font-mono font-medium text-text-muted">
          {tasks.length}
        </span>
      </div>

      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 space-y-2 px-2 pb-2 min-h-[80px] overflow-y-auto scrollbar-none transition-smooth",
              snapshot.isDraggingOver && "bg-accent-orange-glow rounded-b-xl",
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
