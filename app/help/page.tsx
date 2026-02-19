"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  LifeBuoy,
  PlugZap,
  ClipboardList,
  Bot,
  Wrench,
  Search,
  Bug,
  Code,
  ShieldCheck,
  TrendingUp,
  Rocket,
} from "lucide-react";

type UseCase = {
  id: string;
  title: string;
  description: string;
  icon: typeof LifeBuoy;
  ctaHref: string;
};

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary text-text-primary">
          <useCase.icon className="h-4 w-4 text-accent-orange" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{useCase.title}</p>
          <p className="mt-1 text-xs text-text-muted">{useCase.description}</p>
        </div>
      </div>

      <div className="mt-4">
        <Button asChild size="sm" className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white">
          <Link href={useCase.ctaHref}>Open playbook</Link>
        </Button>
      </div>
    </div>
  );
}

function HelpContent() {
  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-orange/15 glow-orange">
          <LifeBuoy className="h-5 w-5 text-accent-orange" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">Resources</h1>
          <p className="mt-1 text-xs text-text-muted">
            Documentation-first overview: what Sutraha HQ is, what to build, and where to start.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">What is Sutraha HQ?</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Sutraha HQ is an operations dashboard for OpenClaw-powered agent systems. It connects your agents,
            tracks execution through tasks/documents/activities, and gives visibility into heartbeat and health.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-accent-orange" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">Integrations</p>
              </div>
              <p className="mt-2 text-xs text-text-muted">OpenClaw gateway + MCP server integration.</p>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-accent-orange" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">Execution</p>
              </div>
              <p className="mt-2 text-xs text-text-muted">Tasks, docs, broadcasts, and activity attribution.</p>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent-orange" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">Multi-agent</p>
              </div>
              <p className="mt-2 text-xs text-text-muted">One workspace, many specialized agents with shared context.</p>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-accent-orange" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">BYO infra</p>
              </div>
              <p className="mt-2 text-xs text-text-muted">Bring your own OpenClaw and model provider keys.</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">Canonical setup flow</h2>
          <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-text-secondary">
            <li>Complete prerequisites in <span className="font-mono text-xs">/onboarding</span>.</li>
            <li>Open Chat and follow the left setup checklist rail.</li>
            <li>Create new agents from recipe flow and continue setup in chat.</li>
          </ol>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="bg-accent-orange hover:bg-accent-orange/90 text-white">
              <Link href="/chat?setup=1">Do setup in Chat</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/agents/new">Create agent (recipe)</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">Use cases</h2>
          <p className="mt-2 text-xs text-text-muted">
            Strategy and operating patterns. Execution still happens from Chat setup + Agents.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              { id: "research", title: "Research a decision", description: "Produce a cited brief + recommendation.", icon: Search, ctaHref: "/help/playbooks/research" },
              { id: "support_triage", title: "Support triage", description: "Turn incoming issues into reproducible tasks.", icon: Bug, ctaHref: "/help/playbooks/support_triage" },
              { id: "code_review", title: "Code review", description: "Find regressions and missing tests.", icon: Code, ctaHref: "/help/playbooks/code_review" },
              { id: "qa", title: "Release QA", description: "Build test plans and release checklists.", icon: ShieldCheck, ctaHref: "/help/playbooks/qa" },
              { id: "growth", title: "Growth experiments", description: "Define measurable hypotheses and experiments.", icon: TrendingUp, ctaHref: "/help/playbooks/growth" },
              { id: "delivery", title: "Ship a feature", description: "Coordinate main agent + specialists to deliver.", icon: Rocket, ctaHref: "/help/playbooks/delivery" },
            ] as UseCase[]).map((uc) => (
              <UseCaseCard key={uc.id} useCase={uc} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">Troubleshooting</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-text-secondary">
            <li>Gateway auth errors: recheck token scopes/role in Settings → OpenClaw.</li>
            <li>Missing agent pulse: verify HEARTBEAT.md + cron prompt + sessionKey alignment.</li>
            <li>Need local OpenClaw config edits: use Settings → OpenClaw → local config editor.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <AppLayout>
      <HelpContent />
    </AppLayout>
  );
}
