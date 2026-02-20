"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { AgentPanel } from "@/components/dashboard/AgentPanel";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
// import { BurnRateCard } from "@/components/dashboard/BurnRateCard";
import { Activity, Bot, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

type MobileTab = "board" | "agents" | "activity";

const mobileTabs: { id: MobileTab; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "board", label: "Board", icon: LayoutDashboard },
  { id: "activity", label: "Live Feed", icon: Activity },
];

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<MobileTab>("board");

  return (
    <>
      {/* ── Desktop: 3-column layout ── */}
      <div className="hidden lg:flex h-[calc(100dvh-3.5rem)]">
        {/* Left sidebar: Agents */}
        <div className="w-[280px] border-r border-border-default bg-bg-secondary overflow-hidden">
          <AgentPanel />
        </div>
        {/* Main area: Kanban */}
        <div className="flex-1 overflow-auto p-6">
          {/* <div className="mb-4">
            <BurnRateCard />
          </div> */}
          <KanbanBoard />
        </div>
        {/* Right sidebar: Activity */}
        <div className="w-[300px] min-h-0 border-l border-border-default bg-bg-secondary overflow-hidden">
          <LiveFeed />
        </div>
      </div>

      {/* ── Mobile: tab-based single view ── */}
      <div className="flex flex-col lg:hidden h-[calc(100dvh-3.5rem)]">
        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "board" && (
            <div className="h-full overflow-auto p-3">
              <KanbanBoard />
            </div>
          )}
          {activeTab === "agents" && (
            <div className="h-full bg-bg-secondary">
              <AgentPanel />
            </div>
          )}
          {activeTab === "activity" && (
            <div className="h-full min-h-0 overflow-hidden bg-bg-secondary">
              <LiveFeed />
            </div>
          )}
        </div>

        {/* Bottom tab bar */}
        <div className="border-t border-border-default bg-bg-secondary pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around">
            {mobileTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-smooth",
                    isActive
                      ? "text-accent-orange"
                      : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  <tab.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_var(--cw-accent-orange)]")} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default function HomePage() {
  return <AppLayout><DashboardContent /></AppLayout>;
}
