"use client";

import { GitBranch } from "lucide-react";
import Link from "next/link";
import { AgentTree } from "@/components/agents/tree/AgentTree";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";

function AgentTreeContent() {
  const { workspaceId } = useWorkspace();

  if (!workspaceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-hover border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-3 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal/20">
            <GitBranch className="h-4 w-4 text-teal" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary sm:text-xl">
              Agent hierarchy
            </h1>
            <p className="hidden text-xs text-text-muted sm:block">
              Parent/child layout from session keys (e.g.{" "}
              <code className="font-mono text-[11px]">agent:main:sub</code>)
            </p>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 w-full sm:w-auto"
        >
          <Link href="/agents">Back to agents</Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <AgentTree workspaceId={workspaceId} />
      </div>
    </div>
  );
}

export default function AgentTreePage() {
  return (
    <AppLayout>
      <AgentTreeContent />
    </AppLayout>
  );
}
