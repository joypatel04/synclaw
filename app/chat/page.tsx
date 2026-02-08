"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChatAgentSelector } from "@/components/chat/ChatAgentSelector";
import { MessageSquare } from "lucide-react";

function ChatContent() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal/20"><MessageSquare className="h-4 w-4 text-teal" /></div>
        <div><h1 className="text-xl font-bold text-text-primary">Chat</h1><p className="text-xs text-text-muted">Direct conversations with your agents</p></div>
      </div>
      <ChatAgentSelector />
    </div>
  );
}

export default function ChatPage() {
  return <AppLayout><ChatContent /></AppLayout>;
}
