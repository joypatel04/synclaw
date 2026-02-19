"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChatAgentSelector } from "@/components/chat/ChatAgentSelector";
import { ListChecks, MessageSquare } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChatSetupRail } from "@/components/chat/ChatSetupRail";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";

function ChatContent() {
  const { workspaceId, canAdmin } = useWorkspace();
  const [setupOpen, setSetupOpen] = useState(false);
  const status = useQuery(
    api.onboarding.getStatus,
    canAdmin ? { workspaceId } : "skip",
  );

  if (canAdmin && status === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal/20"><MessageSquare className="h-4 w-4 text-teal" /></div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary">Chat</h1>
              <p className="text-xs text-text-muted hidden sm:block">Direct conversations with your agents</p>
            </div>
          </div>
          {canAdmin ? (
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setSetupOpen(true)}>
              <ListChecks className="h-4 w-4" />
              Setup Guide
            </Button>
          ) : null}
        </div>
        <ChatAgentSelector />
      </div>

      {canAdmin ? (
        <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-bg-primary border-border-default p-0">
            <SheetHeader className="border-b border-border-default">
              <SheetTitle className="text-text-primary">Setup Guide</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <ChatSetupRail className="border-0 bg-transparent p-0 shadow-none" />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

export default function ChatPage() {
  return <AppLayout><ChatContent /></AppLayout>;
}
