"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ChatInterface } from "@/components/chat/ChatInterface";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { ChatSetupRail } from "@/components/chat/ChatSetupRail";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";

function ChatDetailContent({ agentId }: { agentId: Id<"agents"> }) {
  const { workspaceId, canAdmin } = useWorkspace();
  const [setupOpen, setSetupOpen] = useState(false);
  const agent = useQuery(
    api.agents.getById,
    workspaceId ? { workspaceId, id: agentId } : "skip",
  );

  if (agent === undefined)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  if (agent === null) return <div className="flex items-center justify-center py-20"><p className="text-text-muted">Agent not found</p></div>;

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6">
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-end">
          {canAdmin ? (
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setSetupOpen(true)}>
              <ListChecks className="h-4 w-4" />
              Setup Guide
            </Button>
          ) : null}
        </div>
        <ChatInterface agent={agent} />
      </div>

      {canAdmin ? (
        <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-bg-primary border-border-default p-0">
            <SheetHeader className="border-b border-border-default">
              <SheetTitle className="text-text-primary">Setup Guide</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <ChatSetupRail selectedAgentId={agentId} className="border-0 bg-transparent p-0 shadow-none" />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

export default function ChatDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const id =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : null;

  if (!id) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl p-6">
          <p className="text-sm text-text-muted">
            Missing chat id in route.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ChatDetailContent agentId={id as Id<"agents">} />
    </AppLayout>
  );
}
