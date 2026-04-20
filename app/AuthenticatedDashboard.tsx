"use client";

import { useConvexAuth } from "convex/react";
import { Activity, Bot, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { AgentPanel } from "@/components/dashboard/AgentPanel";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { AppLayout } from "@/components/layout/AppLayout";
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
      <div className="hidden h-[calc(100dvh-4rem)] lg:flex">
        <div className="w-[300px] overflow-hidden border-r border-border-default/80 bg-bg-secondary/60">
          <AgentPanel />
        </div>
        <div className="flex-1 overflow-auto p-5 lg:p-6">
          <KanbanBoard />
        </div>
        <div className="min-h-0 w-[330px] overflow-hidden border-l border-border-default/80 bg-bg-secondary/60">
          <LiveFeed />
        </div>
      </div>

      <div className="flex h-[calc(100dvh-4rem)] flex-col lg:hidden">
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

        <div className="border-t border-border-default bg-bg-secondary pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around">
            {mobileTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "transition-smooth flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                    isActive
                      ? "text-text-secondary"
                      : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  <tab.icon
                    className={cn(
                      "h-5 w-5",
                      isActive &&
                        "drop-shadow-[0_0_4px_rgba(148,163,184,0.35)]",
                    )}
                  />
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

/**
 * Client boundary: shows the dashboard when authenticated,
 * or passes through children (server-rendered landing page) when not.
 */
export function AuthenticatedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-hover border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  );
}
