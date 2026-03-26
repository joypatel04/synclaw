"use client";

import { Bot, CheckCircle2, FileText, MessageSquare, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SectionFrame } from "../SectionFrame";

type WorkflowStage = {
  id: "chat" | "findings" | "docs";
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
};

const stages: WorkflowStage[] = [
  {
    id: "chat",
    eyebrow: "Stage 01",
    title: "Chat with Agent",
    body: "Synclaw keeps OpenClaw chat grounded in active task context so your team and agent stay in one execution loop.",
    bullets: [
      "Live chat stream tied to workspace",
      "Context-rich replies from assigned agent",
      "Clear handoff from conversation to action",
    ],
  },
  {
    id: "findings",
    eyebrow: "Stage 02",
    title: "Task Assigned, Findings Returned",
    body: "When a task is assigned, agent execution and findings appear as structured updates instead of scattered logs.",
    bullets: [
      "Assignment visible in board and activity",
      "Findings summarized with evidence",
      "Status transition without manual stitching",
    ],
  },
  {
    id: "docs",
    eyebrow: "Stage 03",
    title: "Documents Managed Autonomously",
    body: "Agents create and update operational documents while Synclaw exposes timeline, ownership, and latest version state.",
    bullets: [
      "Auto-created docs from execution flow",
      "Revision-safe updates",
      "Workspace-level visibility and control",
    ],
  },
];

const chatLines = [
  {
    who: "You",
    text: "Research the failed webhook retries and summarize root causes.",
  },
  {
    who: "Research Agent",
    text: "I found 3 recurring failures tied to invalid endpoint signatures and timeout thresholds.",
  },
  {
    who: "You",
    text: "Create a remediation task with implementation steps.",
  },
  {
    who: "Research Agent",
    text: "Done. Task created with rollout checklist and owner suggestions.",
  },
] as const;

const findings = [
  "Signature mismatch in 2 provider callbacks",
  "Retry timeout too aggressive for one endpoint",
  "Missing dead-letter fallback for failed events",
] as const;

const docs = [
  { name: "incident-webhooks.md", status: "updated", by: "Research Agent" },
  { name: "runbook-retries.md", status: "created", by: "Ops Agent" },
  { name: "release-checklist.md", status: "updated", by: "Writer Agent" },
] as const;

function StageVisual({ stageId }: { stageId: WorkflowStage["id"] }) {
  if (stageId === "chat") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/45">
            <MessageSquare className="h-3.5 w-3.5" />
            Agent Chat
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
            Synced
          </span>
        </div>
        <div className="space-y-2">
          {chatLines.map((line, idx) => (
            <article
              key={`${line.who}-${idx}`}
              className={cn(
                "rounded-xl border px-3 py-2",
                idx % 2 === 0 ? "bg-white/[0.035]" : "bg-[#12172A]",
              )}
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/48">{line.who}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/78">{line.text}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (stageId === "findings") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/45">
            <Sparkles className="h-3.5 w-3.5" />
            Task Findings
          </div>
          <span className="rounded-full border border-[#7A6CFF]/35 bg-[#7A6CFF]/12 px-2 py-0.5 text-[10px] text-[#AFA7FF]">
            In Progress
          </span>
        </div>

        <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white/86">Webhook Reliability Remediation</p>
          <p className="mt-1 text-xs text-white/52">Assigned to Research Agent • 4m ago</p>
          <ul className="mt-4 space-y-2">
            {findings.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-white/74">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14C995]" />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/45">
          <FileText className="h-3.5 w-3.5" />
          Documents
        </div>
        <span className="rounded-full border border-[#14C995]/30 bg-[#14C995]/12 px-2 py-0.5 text-[10px] text-[#7EE9C6]">
          Auto-updated
        </span>
      </div>

      <div className="space-y-2">
        {docs.map((doc) => (
          <article
            key={doc.name}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] text-white/82">{doc.name}</p>
              <p className="text-[11px] text-white/48">{doc.by}</p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px]",
                doc.status === "created"
                  ? "bg-[#7A6CFF]/14 text-[#B7ADFF]"
                  : "bg-[#14C995]/12 text-[#7EE9C6]",
              )}
            >
              {doc.status}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

export function WorkflowShowcaseDark() {
  const [activeId, setActiveId] = useState<WorkflowStage["id"]>("chat");
  const refs = useRef<Record<WorkflowStage["id"], HTMLElement | null>>({
    chat: null,
    findings: null,
    docs: null,
  });

  useEffect(() => {
    const entries = Object.entries(refs.current).filter(([, el]) => el);
    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        const id = visible.target.getAttribute("data-stage") as WorkflowStage["id"];
        if (id) setActiveId(id);
      },
      {
        threshold: [0.35, 0.55, 0.75],
        rootMargin: "-15% 0px -20% 0px",
      },
    );

    entries.forEach(([, el]) => observer.observe(el as Element));
    return () => observer.disconnect();
  }, []);

  const activeStage = useMemo(
    () => stages.find((stage) => stage.id === activeId) ?? stages[0],
    [activeId],
  );

  return (
    <SectionFrame className="landing-reveal py-24 sm:py-28">
      <div className="mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">
          Real Synclaw workflow
        </p>
        <h2 className="mt-4 max-w-3xl text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-white/92 landing-display">
          From chat to findings to documents,
          <br />
          all in one OpenClaw operating layer
        </h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
        <div className="space-y-20">
          {stages.map((stage) => {
            const isActive = activeStage.id === stage.id;
            return (
              <article
                key={stage.id}
                ref={(el) => {
                  refs.current[stage.id] = el;
                }}
                data-stage={stage.id}
                className={cn(
                  "min-h-[52vh] rounded-3xl border p-6 transition-all duration-500",
                  isActive
                    ? "border-white/24 bg-white/[0.045] shadow-[0_22px_60px_rgba(18,22,42,0.4)]"
                    : "border-white/10 bg-white/[0.02]",
                )}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
                  {stage.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white/90">
                  {stage.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/62">{stage.body}</p>
                <ul className="mt-5 space-y-2">
                  {stage.bullets.map((bullet) => (
                    <li key={bullet} className="text-sm text-white/72">
                      • {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-[26px] border border-white/12 bg-[#0A0D18]/95 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
                <Bot className="h-3.5 w-3.5" />
                Synclaw Runtime Preview
              </div>
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/58">
                {activeStage.eyebrow}
              </span>
            </div>

            <div
              key={activeStage.id}
              className="transition-all duration-500 data-[state=active]:opacity-100"
            >
              <StageVisual stageId={activeStage.id} />
            </div>
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}
