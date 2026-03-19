"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { REQUIRED_AGENT_SETUP_FILES } from "@/lib/agentSetupTemplates";

function AgentSetupGuideContent() {
  const requiredFileCount = REQUIRED_AGENT_SETUP_FILES.length;
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-3 sm:p-6">
      <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-text-primary sm:text-xl">
          Agent Setup Guide
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Canonical setup standard for reliable Synclaw backend coordination.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-text-primary">
          Mandatory {requiredFileCount}-file Pack
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          {REQUIRED_AGENT_SETUP_FILES.map((file) => (
            <li key={file}>
              <span className="font-mono text-xs">{file}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-text-muted">
          `SYNCLAW_PROTOCOL.md` is required and setup remains blocked if
          missing.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-text-primary">Three paths</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
          <li>Guided setup (default): review, diff, apply, validate.</li>
          <li>Chat-driven setup: structured command cards via main agent.</li>
          <li>
            Manual setup: scoped filesystem editor with quick replacements.
          </li>
        </ol>
      </div>

      <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-text-primary">
          Completion checklist
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>
            All {requiredFileCount} required files exist and pass validation
            checks.
          </li>
          <li>Bootstrap step confirmed.</li>
          <li>Cron step confirmed.</li>
          <li>First pulse detected.</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          className="bg-accent-orange text-white hover:bg-accent-orange/90"
        >
          <Link href="/agents">Open agents</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/chat">Open chat</Link>
        </Button>
      </div>
    </div>
  );
}

export default function AgentSetupGuidePage() {
  return (
    <AppLayout>
      <AgentSetupGuideContent />
    </AppLayout>
  );
}
