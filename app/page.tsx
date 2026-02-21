"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { AgentPanel } from "@/components/dashboard/AgentPanel";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
// import { BurnRateCard } from "@/components/dashboard/BurnRateCard";
import {
  Activity,
  ArrowRight,
  Bot,
  Boxes,
  Cable,
  CheckCircle2,
  Database,
  LayoutDashboard,
  ServerCog,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

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

function LandingPage() {
  const palettes = [
    {
      id: "obsidian",
      label: "Obsidian",
      vars: {
        "--cw-bg-primary": "#0a0a0f",
        "--cw-bg-secondary": "#12121a",
        "--cw-bg-tertiary": "#1a1a24",
        "--cw-bg-hover": "#22222e",
        "--cw-text-primary": "#e8e8ec",
        "--cw-text-secondary": "#9ca3af",
        "--cw-text-muted": "#6b7280",
        "--cw-text-dim": "#4b5563",
        "--cw-accent-orange": "#f97316",
        "--cw-accent-orange-dim": "rgba(249, 115, 22, 0.2)",
        "--cw-teal": "#14b8a6",
        "--cw-border-default": "#272735",
      },
    },
    {
      id: "ink",
      label: "Ink Blue",
      vars: {
        "--cw-bg-primary": "#090d16",
        "--cw-bg-secondary": "#111827",
        "--cw-bg-tertiary": "#172033",
        "--cw-bg-hover": "#1f2b45",
        "--cw-text-primary": "#e5ecff",
        "--cw-text-secondary": "#b6c2de",
        "--cw-text-muted": "#8796b7",
        "--cw-text-dim": "#5f7096",
        "--cw-accent-orange": "#ff8a3c",
        "--cw-accent-orange-dim": "rgba(255, 138, 60, 0.22)",
        "--cw-teal": "#2dd4bf",
        "--cw-border-default": "#2a3550",
      },
    },
    {
      id: "forest",
      label: "Forest",
      vars: {
        "--cw-bg-primary": "#0b1110",
        "--cw-bg-secondary": "#101b19",
        "--cw-bg-tertiary": "#152522",
        "--cw-bg-hover": "#1c322e",
        "--cw-text-primary": "#e9f1ee",
        "--cw-text-secondary": "#b8cdc5",
        "--cw-text-muted": "#88a49a",
        "--cw-text-dim": "#607d74",
        "--cw-accent-orange": "#ff7f50",
        "--cw-accent-orange-dim": "rgba(255, 127, 80, 0.22)",
        "--cw-teal": "#34d399",
        "--cw-border-default": "#27423c",
      },
    },
    {
      id: "ivory",
      label: "Ivory",
      vars: {
        "--cw-bg-primary": "#f8f5ef",
        "--cw-bg-secondary": "#f1ede5",
        "--cw-bg-tertiary": "#e8e1d6",
        "--cw-bg-hover": "#dfd5c7",
        "--cw-text-primary": "#1f1c18",
        "--cw-text-secondary": "#4c443b",
        "--cw-text-muted": "#726759",
        "--cw-text-dim": "#9a8f81",
        "--cw-accent-orange": "#d4632a",
        "--cw-accent-orange-dim": "rgba(212, 99, 42, 0.14)",
        "--cw-teal": "#0f766e",
        "--cw-border-default": "#d5ccbe",
      },
    },
  ] as const;

  const [activePaletteId, setActivePaletteId] = useState<(typeof palettes)[number]["id"]>("obsidian");
  const activePalette =
    palettes.find((p) => p.id === activePaletteId) ?? palettes[0];

  const workflowSteps = [
    {
      title: "Capture",
      text: "Collect ideas, tasks, and notes in one workspace without context loss.",
    },
    {
      title: "Delegate",
      text: "Assign execution to specialized agents with clear ownership and deadlines.",
    },
    {
      title: "Review",
      text: "Track activity in real time and approve work with confidence.",
    },
    {
      title: "Ship",
      text: "Turn finished work into published output faster, with less coordination overhead.",
    },
  ];

  const capabilities = [
    {
      title: "Mission Control Board",
      text: "Plan priorities, rebalance workload, and prevent drift before it compounds.",
    },
    {
      title: "Agent Operations",
      text: "Keep autonomous workers aligned with your standards and operating rhythm.",
    },
    {
      title: "Live Audit Trail",
      text: "Know what changed, who changed it, and why it matters.",
    },
    {
      title: "Workspace Governance",
      text: "Role-based controls designed for solo operators now and teams later.",
    },
  ];

  const faqs = [
    {
      q: "Is this only for technical teams?",
      a: "No. It is built for operators, creators, and solopreneurs who want disciplined execution, even without a large team.",
    },
    {
      q: "Can I start solo and add team members later?",
      a: "Yes. The workspace model is designed to scale from one person to a structured team with role controls.",
    },
    {
      q: "What happens while billing is not live?",
      a: "You can explore the product flow and core experience. Billing and checkout are being finalized separately.",
    },
  ];

  const architecture = [
    {
      title: "OpenClaw Gateway",
      subtitle: "Execution runtime",
      text: "Runs agent sessions, model calls, and live command loops.",
      icon: Boxes,
      chips: ["Realtime WS", "Session orchestration", "Agent runtime"],
    },
    {
      title: "MCP Server",
      subtitle: "Tool bridge",
      text: "Connects agents to structured tools and workspace actions safely.",
      icon: ServerCog,
      chips: ["Tool contracts", "Controlled actions", "Automation hooks"],
    },
    {
      title: "Convex Workspace Layer",
      subtitle: "Source of truth",
      text: "Stores tasks, docs, activity, members, and permissions.",
      icon: Database,
      chips: ["Role-based access", "Live sync", "Audit-friendly data"],
    },
  ];

  return (
    <div
      className="min-h-screen bg-bg-primary text-text-primary"
      style={activePalette.vars as React.CSSProperties}
    >
      <div
        className="bg-drift pointer-events-none fixed inset-0 -z-10 opacity-35"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0, transparent 23px, rgba(255,255,255,0.035) 24px), repeating-linear-gradient(90deg, transparent 0, transparent 23px, rgba(255,255,255,0.02) 24px)",
        }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="float-slow absolute -left-20 top-28 h-56 w-56 rounded-full bg-accent-orange/20 blur-3xl" />
        <div className="float-slower absolute right-8 top-52 h-64 w-64 rounded-full bg-teal/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border-default/70 bg-bg-primary/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-orange/20">
              <Zap className="h-4 w-4 text-accent-orange" />
            </div>
            <div>
              <p className="text-sm font-semibold">{brand.product.name}</p>
              <p className="text-[11px] text-text-dim">{brand.product.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 rounded-lg border border-border-default bg-bg-secondary p-1 sm:flex">
              {palettes.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => setActivePaletteId(palette.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-smooth",
                    activePaletteId === palette.id
                      ? "bg-accent-orange text-white"
                      : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  {palette.label}
                </button>
              ))}
            </div>
            <Link
              href="/login"
              className="rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover"
            >
              {brand.marketing.signInLabel}
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-accent-orange px-3 py-2 text-sm font-semibold text-white hover:bg-accent-orange/90"
            >
              {brand.marketing.primaryCtaLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <section data-reveal-delay="0" className="section-reveal grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-secondary px-3 py-1 text-xs text-text-secondary">
              <Shield className="h-3.5 w-3.5 text-teal" />
              {brand.marketing.trustBadge}
            </div>
            <h1 className="max-w-2xl text-[clamp(2.3rem,5.2vw,4.5rem)] font-bold leading-[1.03] tracking-tight">
              {brand.marketing.heroHeadline}{" "}
              <span className="text-accent-orange">{brand.marketing.heroAccent}</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">
              {brand.marketing.heroSubheadline}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-orange px-5 py-3 text-sm font-semibold text-white hover:bg-accent-orange/90"
              >
                {brand.marketing.primaryCtaLabel}
                <ArrowRight className="cta-arrow h-4 w-4" />
              </Link>
              <Link
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-secondary px-5 py-3 text-sm font-semibold text-text-secondary hover:bg-bg-hover"
              >
                {brand.marketing.secondaryCtaLabel}
              </Link>
            </div>
            <div className="mt-8 grid gap-2 text-sm text-text-muted sm:grid-cols-2">
              {brand.marketing.benefitBullets.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-card-motion rounded-2xl border border-border-default bg-bg-secondary p-5 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
            <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3">
              <p className="text-sm font-semibold">{brand.marketing.snapshotTitle}</p>
              <span className="pulse-live rounded-md bg-teal/15 px-2 py-1 text-xs font-medium text-teal">
                {brand.marketing.snapshotLiveLabel}
              </span>
            </div>
            <div className="space-y-3">
              {brand.marketing.snapshotRows.map((row, index) => {
                const Icon =
                  index === 0 ? Bot : index === 1 ? LayoutDashboard : Activity;
                return (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-border-default bg-bg-primary px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Icon className="h-4 w-4 text-accent-orange" />
                    {row.label}
                  </div>
                  <span className="text-sm font-semibold text-text-primary">{row.value}</span>
                </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border border-border-default bg-bg-primary px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-text-dim">
                {brand.marketing.snapshotNoteTitle}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {brand.marketing.snapshotNoteBody}
              </p>
            </div>
          </div>
        </section>

        <section data-reveal-delay="1" className="section-reveal mt-8 grid gap-3 border-y border-border-default py-5 sm:grid-cols-3">
          {brand.marketing.proofStrip.map((s) => (
            <div key={s.label} className="rounded-xl border border-border-default bg-bg-secondary px-4 py-3">
              <p className="text-lg font-semibold text-text-primary">{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
            </div>
          ))}
        </section>

        <section data-reveal-delay="2" className="section-reveal mt-14">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold sm:text-2xl">{brand.marketing.productInActionTitle}</h2>
            <p className="text-xs text-text-dim">{brand.marketing.productInActionSubtitle}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <article className="overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
              <div className="border-b border-border-default bg-bg-primary/40 px-4 py-2">
                <p className="text-xs uppercase tracking-wider text-text-dim">{brand.marketing.visualCards[0]?.title ?? "Task Board Lanes"}</p>
              </div>
              <div className="grid h-52 grid-cols-5 gap-2 p-3">
                {["Inbox", "Assigned", "In-Progress", "Review", "Done"].map((col, i) => (
                  <div key={col} className="rounded-lg border border-border-default bg-bg-primary p-1.5">
                    <p className="mb-1 text-[10px] text-text-dim">{col}</p>
                    <div className={cn("space-y-1", i > 2 && "opacity-80")}>
                      <div className="h-4 rounded bg-bg-secondary" />
                      <div className="h-4 rounded bg-bg-secondary" />
                      {i === 3 ? <div className="h-4 rounded bg-accent-orange/30" /> : null}
                    </div>
                  </div>
                ))}
              </div>
              <p className="px-4 pb-3 text-sm text-text-muted">
                {brand.marketing.visualCards[0]?.caption ?? "Mirrors your real task workflow: Inbox to Review to Done."}
              </p>
            </article>

            <article className="overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
              <div className="border-b border-border-default bg-bg-primary/40 px-4 py-2">
                <p className="text-xs uppercase tracking-wider text-text-dim">{brand.marketing.visualCards[1]?.title ?? "Agents Panel"}</p>
              </div>
              <div className="h-52 space-y-2 p-3">
                {[
                  { emoji: "🧠", name: "Research Agent", status: "active" },
                  { emoji: "✍️", name: "Content Agent", status: "active" },
                  { emoji: "🔎", name: "QA Agent", status: "idle" },
                ].map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center justify-between rounded-lg border border-border-default bg-bg-primary px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span>{a.emoji}</span>
                      <span>{a.name}</span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                        a.status === "active"
                          ? "bg-status-active/20 text-status-active"
                          : "bg-bg-secondary text-text-dim",
                      )}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
              <p className="px-4 pb-3 text-sm text-text-muted">
                {brand.marketing.visualCards[1]?.caption ?? "Shows active/idle state exactly like your workspace agent operations."}
              </p>
            </article>

            <article className="overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
              <div className="border-b border-border-default bg-bg-primary/40 px-4 py-2">
                <p className="text-xs uppercase tracking-wider text-text-dim">{brand.marketing.visualCards[2]?.title ?? "Live Feed"}</p>
              </div>
              <div className="h-52 p-3">
                <div className="mb-2 flex gap-1.5">
                  {["All", "Tasks", "Docs", "Mentions"].map((f, idx) => (
                    <span
                      key={f}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px]",
                        idx === 0
                          ? "border-accent-orange bg-accent-orange/15 text-accent-orange"
                          : "border-border-default text-text-muted",
                      )}
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {[
                    "Task updated: Launch copy revised",
                    "Doc created: GTM brief v1",
                    "Broadcast sent to 3 agents",
                    "Mention: QA requested review",
                  ].map((e) => (
                    <div
                      key={e}
                      className="rounded-md border border-border-default bg-bg-primary px-2.5 py-1.5 text-[11px] text-text-secondary"
                    >
                      {e}
                    </div>
                  ))}
                </div>
              </div>
              <p className="px-4 pb-3 text-sm text-text-muted">
                {brand.marketing.visualCards[2]?.caption ?? "Category filters and event stream map to your existing activity feed."}
              </p>
            </article>
          </div>
        </section>

        <section data-reveal-delay="3" className="section-reveal mt-14 rounded-2xl border border-border-default bg-bg-secondary p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-2">
            <Cable className="h-4 w-4 text-accent-orange" />
            <h2 className="text-xl font-semibold sm:text-2xl">{brand.marketing.howItWorksTitle}</h2>
          </div>

          <div className="grid items-stretch gap-4 lg:grid-cols-3">
            {architecture.map((item, idx) => (
              <div
                key={item.title}
                className="relative h-full rounded-xl border border-border-default bg-bg-primary p-4"
              >
                {idx < architecture.length - 1 ? (
                  <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-border-default bg-bg-secondary p-1 lg:inline-flex">
                    <ArrowRight className="h-3.5 w-3.5 text-text-dim" />
                  </span>
                ) : null}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-orange/15">
                    <item.icon className="h-4 w-4 text-accent-orange" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-text-dim">
                    {item.subtitle}
                  </span>
                </div>
                <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                <p className="mt-2 text-sm text-text-muted">{item.text}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-md border border-border-default bg-bg-secondary px-2 py-1 text-[11px] text-text-secondary"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-border-default bg-bg-primary p-4">
            <p className="text-xs uppercase tracking-wider text-text-dim">{brand.marketing.operatorFlowTitle}</p>
            <p className="mt-2 text-sm text-text-secondary">
              {brand.marketing.operatorFlowBody}
            </p>
          </div>
        </section>

        <section data-reveal-delay="4" className="section-reveal mt-16">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-orange" />
            <h2 className="text-xl font-semibold sm:text-2xl">{brand.marketing.creativeTitle}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step, idx) => (
              <div
                key={step.title}
                className="rounded-xl border border-border-default bg-bg-secondary p-4"
              >
                <p className="text-[11px] uppercase tracking-wider text-text-dim">Step {idx + 1}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">{step.title}</p>
                <p className="mt-2 text-sm text-text-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section data-reveal-delay="5" className="section-reveal mt-16 grid gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 lg:col-span-5">
            <p className="text-xs uppercase tracking-wider text-text-dim">{brand.marketing.whyKicker}</p>
            <h3 className="mt-2 text-2xl font-semibold">
              {brand.marketing.whyHeadline}
            </h3>
            <p className="mt-3 text-sm text-text-muted">
              {brand.marketing.whyBody}
            </p>
            <div className="mt-5 space-y-2">
              {brand.marketing.whyBullets.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                  <CheckCircle2 className="h-4 w-4 text-teal" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:col-span-7 sm:grid-cols-2">
            {capabilities.map((cap) => (
              <div key={cap.title} className="rounded-2xl border border-border-default bg-bg-secondary p-5">
                <p className="text-sm font-semibold text-text-primary">{cap.title}</p>
                <p className="mt-2 text-sm text-text-muted">{cap.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section data-reveal-delay="6" className="section-reveal mt-16 grid gap-4 sm:grid-cols-3">
          {brand.marketing.segmentCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-border-default bg-bg-secondary p-5">
              <p className="text-sm font-semibold text-text-primary">{card.title}</p>
              <p className="mt-2 text-sm text-text-muted">{card.text}</p>
            </div>
          ))}
        </section>

        <section id="pricing" data-reveal-delay="7" className="section-reveal mt-16 rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-text-dim">
                {brand.marketing.pricingKicker}
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {brand.marketing.pricingHeadline}
              </h2>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-orange/90"
            >
              {brand.marketing.pricingCtaLabel}
              <Sparkles className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-border-default bg-bg-primary p-4">
              <p className="text-sm font-semibold">{brand.marketing.trialTitle}</p>
              <p className="mt-2 text-sm text-text-muted">{brand.marketing.trialSummary}</p>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-primary p-4">
              <p className="text-sm font-semibold">Starter</p>
              <p className="mt-2 text-sm text-text-muted">
                {brand.marketing.starterSummary}
              </p>
            </div>
            <div className="rounded-xl border border-accent-orange/40 bg-bg-primary p-4">
              <p className="text-sm font-semibold">Pro</p>
              <p className="mt-2 text-sm text-text-muted">
                {brand.marketing.proSummary}
              </p>
            </div>
          </div>
        </section>

        <section data-reveal-delay="8" className="section-reveal mt-16 grid gap-4 sm:grid-cols-3">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-border-default bg-bg-secondary p-5">
              <p className="text-sm font-semibold text-text-primary">{faq.q}</p>
              <p className="mt-2 text-sm text-text-muted">{faq.a}</p>
            </div>
          ))}
        </section>

        <section data-reveal-delay="9" className="section-reveal mt-16 rounded-2xl border border-border-default bg-bg-secondary p-8 text-center">
          <p className="text-xs uppercase tracking-wider text-text-dim">{brand.marketing.finalCtaKicker}</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
            {brand.marketing.finalCtaHeadline}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-text-muted">
            {brand.marketing.finalCtaBody}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-orange px-5 py-3 text-sm font-semibold text-white hover:bg-accent-orange/90"
            >
              {brand.marketing.primaryCtaLabel}
              <ArrowRight className="cta-arrow h-4 w-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-primary px-5 py-3 text-sm font-semibold text-text-secondary hover:bg-bg-hover"
            >
              {brand.marketing.exploreDocsLabel}
            </Link>
          </div>
        </section>
      </main>
      <style jsx global>{`
        .section-reveal {
          opacity: 0;
          transform: translateY(20px);
          animation: revealUp 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .section-reveal[data-reveal-delay="1"] { animation-delay: 60ms; }
        .section-reveal[data-reveal-delay="2"] { animation-delay: 100ms; }
        .section-reveal[data-reveal-delay="3"] { animation-delay: 140ms; }
        .section-reveal[data-reveal-delay="4"] { animation-delay: 180ms; }
        .section-reveal[data-reveal-delay="5"] { animation-delay: 220ms; }
        .section-reveal[data-reveal-delay="6"] { animation-delay: 260ms; }
        .section-reveal[data-reveal-delay="7"] { animation-delay: 300ms; }
        .section-reveal[data-reveal-delay="8"] { animation-delay: 340ms; }
        .section-reveal[data-reveal-delay="9"] { animation-delay: 380ms; }
        @supports (animation-timeline: view()) {
          .section-reveal {
            opacity: 1;
            transform: none;
            animation: revealUp 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
            animation-timeline: view();
            animation-range: entry 10% cover 30%;
            animation-delay: 0ms;
          }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-18px); }
        }
        @keyframes floatSlower {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(14px); }
        }
        @keyframes revealUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0px); }
        }
        @keyframes gridDrift {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(-14px, -10px, 0); }
        }
        @keyframes pulseLive {
          0%, 100% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.36); }
          50% { box-shadow: 0 0 0 8px rgba(20, 184, 166, 0); }
        }
        @keyframes arrowNudge {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(5px); }
        }
        @keyframes heroCardFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .bg-drift { animation: gridDrift 11s ease-in-out infinite; }
        .float-slow { animation: floatSlow 9s ease-in-out infinite; }
        .float-slower { animation: floatSlower 13s ease-in-out infinite; }
        .pulse-live { animation: pulseLive 1.9s ease-out infinite; }
        .cta-arrow { animation: arrowNudge 1.6s ease-in-out infinite; }
        .hero-card-motion { animation: heroCardFloat 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export default function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  );
}
