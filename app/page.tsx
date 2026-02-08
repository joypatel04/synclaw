"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { AgentPanel } from "@/components/dashboard/AgentPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

function DashboardContent() {
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      {/* Main area: Kanban */}
      <div className="flex-1 overflow-auto p-6">
        <KanbanBoard />
      </div>
      {/* Right sidebar */}
      <div className="w-full lg:w-[320px] flex flex-col border-t lg:border-t-0 lg:border-l border-border-default bg-bg-secondary">
        <div className="flex-1 overflow-hidden">
          <AgentPanel />
        </div>
        <div className="h-px bg-border-default" />
        <div className="flex-1 overflow-hidden">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return <AppLayout><DashboardContent /></AppLayout>;
}
