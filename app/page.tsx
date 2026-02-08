"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { AgentPanel } from "@/components/dashboard/AgentPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

function DashboardContent() {
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      {/* Left sidebar: Agents */}
      <div className="w-full lg:w-[280px] border-b lg:border-b-0 lg:border-r border-border-default bg-bg-secondary overflow-hidden">
        <AgentPanel />
      </div>
      {/* Main area: Kanban */}
      <div className="flex-1 overflow-auto p-6">
        <KanbanBoard />
      </div>
      {/* Right sidebar: Activity */}
      <div className="w-full lg:w-[300px] border-t lg:border-t-0 lg:border-l border-border-default bg-bg-secondary overflow-hidden">
        <ActivityFeed />
      </div>
    </div>
  );
}

export default function HomePage() {
  return <AppLayout><DashboardContent /></AppLayout>;
}
