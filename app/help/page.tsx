"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  buildMainAgentBootstrapMessage,
  buildMcpServerConfigTemplate,
} from "@/lib/onboardingTemplates";
import { buildAgentRecipePrompt, AGENT_RECIPES } from "@/lib/agentRecipes";
import { buildSutrahaProtocolMd, SUTRAHA_PROTOCOL_FILENAME } from "@/lib/sutrahaProtocol";
import {
  Check,
  Copy,
  LifeBuoy,
  Sparkles,
  PlugZap,
  ClipboardList,
  FileText,
  Bot,
  Rocket,
  Wrench,
  Search,
  Bug,
  Code,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

type UseCase = {
  id: string;
  title: string;
  description: string;
  icon: typeof LifeBuoy;
  bullets: string[];
  ctaHref: string;
  ctaLabel: string;
};

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary text-text-primary">
          <useCase.icon className="h-4 w-4 text-accent-orange" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {useCase.title}
          </p>
          <p className="mt-1 text-xs text-text-muted">{useCase.description}</p>
        </div>
      </div>

      <ul className="mt-3 list-disc pl-5 space-y-1 text-xs text-text-secondary">
        {useCase.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <div className="mt-4">
        <Button asChild size="sm" className="h-8 bg-accent-orange hover:bg-accent-orange/90 text-white">
          <Link href={useCase.ctaHref}>{useCase.ctaLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

function CopyCard({
  id,
  title,
  value,
  copiedId,
  onCopy,
}: {
  id: string;
  title: string;
  value: string;
  copiedId: string | null;
  onCopy: (id: string, value: string) => Promise<void>;
}) {
  const copied = copiedId === id;
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
          {title}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onCopy(id, value)}
          className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? (
            <Check className="h-4 w-4 text-status-active" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <pre className="mt-3 max-h-[320px] overflow-auto rounded-lg bg-bg-primary border border-border-default p-3 font-mono text-[11px] text-text-primary whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

function HelpContent() {
  const { workspaceId, workspace } = useWorkspace();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const mainBootstrap = useMemo(() => {
    return buildMainAgentBootstrapMessage({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
    });
  }, [workspace.name, workspaceId]);

  const mcporterConfig = useMemo(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    return buildMcpServerConfigTemplate({
      workspaceId: String(workspaceId),
      convexUrl,
      convexSiteUrl,
    });
  }, [workspaceId]);

  const protocolMd = useMemo(() => {
    return buildSutrahaProtocolMd({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
    });
  }, [workspace.name, workspaceId]);

  const agentPromptSkeleton = useMemo(() => {
    const recipe = AGENT_RECIPES[0];
    return buildAgentRecipePrompt({
      workspaceName: workspace.name,
      workspaceId: String(workspaceId),
      agentName: "New Agent",
      sessionKey: "agent:new-agent:main",
      recipe,
      spec: "",
    });
  }, [workspace.name, workspaceId]);

  const exampleSpec = `Goal: Build a support triage agent for Sutraha HQ.

Scope:
- Incoming: user bug reports + onboarding issues + OpenClaw connection failures
- Output: a Sutraha HQ Task with severity + reproduction steps + suspected cause

Rules:
- Severity:
  - P0: login broken, data loss, billing, security
  - P1: core chat/onboarding broken
  - P2: degraded UX
- Always ask for: exact URL, timestamp, browser, console error, and steps to reproduce
- If it smells like CORS/origin or ws/wss mismatch, call it out explicitly

Definition of done:
- Every issue results in a Task with clear next action and owner (or @mention owner if unknown)`;

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-orange/15 glow-orange">
          <LifeBuoy className="h-5 w-5 text-accent-orange" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Resources
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            What Sutraha HQ is, what you can build, and the fastest paths to value.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            What is Sutraha HQ?
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Sutraha HQ is an operations dashboard for OpenClaw-powered agent systems. It helps you connect your own OpenClaw gateway, register agents, and turn conversations into durable execution artifacts.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-accent-orange" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Integrations
                </p>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Connect OpenClaw via WebSocket and connect agents to Sutraha HQ via MCP tools.
              </p>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-accent-orange" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Execution
                </p>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Use Tasks, Documents, and Broadcasts as the source of truth instead of scattered chat logs.
              </p>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent-orange" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Multi-agent
                </p>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                One workspace usually contains multiple agents (main + specialists) that share a project context.
              </p>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-tertiary p-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-accent-orange" />
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  BYO Keys
                </p>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Bring your own OpenClaw + model provider keys. Sutraha HQ focuses on orchestration and observability.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Core workflow
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="min-w-0 rounded-xl border border-border-default bg-bg-tertiary p-4 flex flex-col">
              <p className="text-xs font-semibold text-text-primary">1) Connect</p>
              <p className="mt-1 text-[11px] text-text-muted">
                Add your OpenClaw gateway URL + token.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-full whitespace-normal h-auto py-2 leading-tight"
              >
                <Link href="/settings/openclaw">OpenClaw settings</Link>
              </Button>
            </div>
            <div className="min-w-0 rounded-xl border border-border-default bg-bg-tertiary p-4 flex flex-col">
              <p className="text-xs font-semibold text-text-primary">2) Register</p>
              <p className="mt-1 text-[11px] text-text-muted">
                Create the main agent and any specialists.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-full whitespace-normal h-auto py-2 leading-tight"
              >
                <Link href="/agents/new">Create agent (recipe)</Link>
              </Button>
            </div>
            <div className="min-w-0 rounded-xl border border-border-default bg-bg-tertiary p-4 flex flex-col">
              <p className="text-xs font-semibold text-text-primary">3) Prime</p>
              <p className="mt-1 text-[11px] text-text-muted">
                Give agents a bootstrap prompt with MCP rules.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-full whitespace-normal h-auto py-2 leading-tight"
              >
                <Link href="/chat">Chat</Link>
              </Button>
            </div>
            <div className="min-w-0 rounded-xl border border-border-default bg-bg-tertiary p-4 flex flex-col">
              <p className="text-xs font-semibold text-text-primary">4) Ship</p>
              <p className="mt-1 text-[11px] text-text-muted">
                Use Tasks + Documents to execute and track progress.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-full whitespace-normal h-auto py-2 leading-tight"
              >
                <Link href="/documents">Documents</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-orange" />
            <h2 className="text-sm font-semibold text-text-primary">
              Use cases (starter recipes)
            </h2>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Pick a use case, generate a prompt with a SPEC block, then paste it into OpenClaw.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              {
                id: "research",
                title: "Research a decision",
                description: "Get a cited brief + recommendation.",
                icon: Search,
                bullets: [
                  "Compare options and tradeoffs",
                  "Write the long brief to Documents",
                  "Create tasks for follow-ups",
                ],
                ctaHref: "/help/playbooks/research",
                ctaLabel: "Open playbook",
              },
              {
                id: "support_triage",
                title: "Support triage",
                description: "Turn issues into reproducible tasks.",
                icon: Bug,
                bullets: [
                  "Collect repro steps + environment details",
                  "Tag severity and owner",
                  "Create tasks with acceptance criteria",
                ],
                ctaHref: "/help/playbooks/support_triage",
                ctaLabel: "Open playbook",
              },
              {
                id: "code_review",
                title: "Code review",
                description: "Catch bugs and missing tests early.",
                icon: Code,
                bullets: [
                  "Review diffs for risk and regressions",
                  "Suggest concrete fixes",
                  "Request missing tests",
                ],
                ctaHref: "/help/playbooks/code_review",
                ctaLabel: "Open playbook",
              },
              {
                id: "qa",
                title: "Release QA",
                description: "Build a test plan and validate releases.",
                icon: ShieldCheck,
                bullets: [
                  "Critical paths + edge cases",
                  "Acceptance criteria checklists",
                  "Rollout/rollback notes",
                ],
                ctaHref: "/help/playbooks/qa",
                ctaLabel: "Open playbook",
              },
              {
                id: "growth",
                title: "Growth experiments",
                description: "Define hypotheses and measurable tests.",
                icon: TrendingUp,
                bullets: [
                  "Hypothesis + metric + threshold",
                  "2-3 focused experiments",
                  "Write experiment docs + tasks",
                ],
                ctaHref: "/help/playbooks/growth",
                ctaLabel: "Open playbook",
              },
              {
                id: "delivery",
                title: "Ship a feature (multi-agent)",
                description: "Orchestrate from spec to shipped.",
                icon: Rocket,
                bullets: [
                  "Main agent creates tasks and delegates",
                  "Specialists write docs and checklists",
                  "Broadcast status updates to the team",
                ],
                ctaHref: "/help/playbooks/delivery",
                ctaLabel: "Open playbook",
              },
            ] as UseCase[]).map((uc) => (
              <UseCaseCard key={uc.id} useCase={uc} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Quickstart (10 minutes)
          </h2>
          <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-text-secondary">
            <li>
              Connect OpenClaw in{" "}
              <Link href="/settings/openclaw" className="text-accent-orange underline">
                Settings → OpenClaw
              </Link>{" "}
              (make sure your OpenClaw gateway allows this origin).
            </li>
            <li>
              Create your main agent in{" "}
              <Link href="/onboarding" className="text-accent-orange underline">
                /onboarding
              </Link>{" "}
              (sessionKey <span className="font-mono text-xs">agent:main:main</span>).
            </li>
            <li>
              Start the Sutraha HQ MCP server (where your agent runtime runs), using the MCPorter config template below.
            </li>
            <li>
              Prime the main agent by pasting the bootstrap prompt into chat once.
            </li>
          </ol>
        </div>

        <CopyCard
          id="main_bootstrap"
          title="Main Agent Bootstrap Message (paste into chat once)"
          value={mainBootstrap}
          copiedId={copiedId}
          onCopy={copy}
        />

        <CopyCard
          id="mcporter"
          title="MCPorter config template (Sutraha HQ MCP Server)"
          value={mcporterConfig}
          copiedId={copiedId}
          onCopy={copy}
        />

        <CopyCard
          id="protocol"
          title={`${SUTRAHA_PROTOCOL_FILENAME} (copy into each agent workspace)`}
          value={protocolMd}
          copiedId={copiedId}
          onCopy={copy}
        />

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Adding a new agent (recommended flow)
          </h2>
          <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-text-secondary">
            <li>
              Create the agent in Sutraha HQ using{" "}
              <Link href="/agents/new" className="text-accent-orange underline">
                Agents → Use recipe
              </Link>
              .
            </li>
            <li>
              Copy the generated prompt into OpenClaw (or send it as the first chat message if you are using chat-first prompting).
            </li>
            <li>
              Ensure the OpenClaw sessionKey matches the agent’s sessionKey in Sutraha HQ.
            </li>
          </ol>
          <div className="mt-4 rounded-lg border border-border-default bg-bg-tertiary p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
              Prompt rule
            </p>
            <p className="mt-2 text-xs text-text-muted">
              Users only edit the spec between{" "}
              <span className="font-mono">SPEC_START</span> /{" "}
              <span className="font-mono">SPEC_END</span>. Everything else stays fixed so the agent behaves consistently.
            </p>
          </div>
        </div>

        <CopyCard
          id="agent_skeleton"
          title="Agent prompt template (spec block included)"
          value={agentPromptSkeleton}
          copiedId={copiedId}
          onCopy={copy}
        />

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                Example spec (paste into SPEC_START/END)
              </p>
              <p className="mt-1 text-xs text-text-muted">
                This is the only part most users should write.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void copy("example_spec", exampleSpec)}
              className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
              title={copiedId === "example_spec" ? "Copied" : "Copy"}
            >
              {copiedId === "example_spec" ? (
                <Check className="h-4 w-4 text-status-active" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Textarea
            readOnly
            value={exampleSpec}
            rows={10}
            className="mt-3 bg-bg-primary border-border-default text-text-primary font-mono text-[11px] leading-relaxed"
          />
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Workspace vs agent (rule of thumb)
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Default: one workspace per team/project/OpenClaw deployment, with many agents inside. Create a new workspace only when you need isolation (different members, permissions, or a different OpenClaw gateway).
          </p>
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Troubleshooting
          </h2>
          <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-text-secondary">
            <li>
              WebSocket fails on localhost: confirm you are using <span className="font-mono text-xs">ws://</span> for local gateways, and your gateway allows the origin shown in Settings → OpenClaw.
            </li>
            <li>
              Auth rejected: verify token/password and the gateway role/scopes.
            </li>
            <li>
              “Agent not found” from MCP: your agent’s sessionKey in OpenClaw must match Sutraha HQ exactly.
            </li>
            <li>
              Need to edit the OpenClaw repo config on your machine: use Settings → OpenClaw → “OpenClaw config file (local)”. (Works best on Chrome/Edge.)
            </li>
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
