"use client";

import { useConvexAuth } from "convex/react";
import {
  Activity,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  LayoutDashboard,
  Lock,
  Monitor,
  ShieldCheck,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AgentPanel } from "@/components/dashboard/AgentPanel";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { HeroDashboardCarousel } from "@/components/landing/HeroDashboardCarousel";
import { AppLayout } from "@/components/layout/AppLayout";
import { brand } from "@/lib/brand";
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
      {/* ── Desktop: 3-column layout ── */}
      <div className="hidden lg:flex h-[calc(100dvh-3.5rem)]">
        {/* Left sidebar: Agents */}
        <div className="w-[280px] border-r border-border-default bg-bg-secondary overflow-hidden">
          <AgentPanel />
        </div>
        {/* Main area: Kanban */}
        <div className="flex-1 overflow-auto p-6">
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
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-smooth",
                    isActive
                      ? "text-accent-orange"
                      : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  <tab.icon
                    className={cn(
                      "h-5 w-5",
                      isActive &&
                        "drop-shadow-[0_0_6px_var(--cw-accent-orange)]",
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

// ── Landing page design tokens ─────────────────────────────
const LP = {
  bg: "#080A0F",
  surface: "rgba(255,255,255,0.025)",
  surfaceHover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
  accent: "#6366F1",
  accentDim: "rgba(99,102,241,0.12)",
  accentGlow: "rgba(99,102,241,0.22)",
  text: "#EDEEF0",
  muted: "#94A3B8",
  dim: "#4A5568",
  emerald: "#10B981",
  amber: "#F59E0B",
} as const;

function LandingPage() {
  const features = [
    {
      icon: Monitor,
      title: "Agent Monitoring",
      text: "Real-time status, health, and telemetry for every OpenClaw agent. Know exactly what's running and what's stuck.",
    },
    {
      icon: LayoutDashboard,
      title: "Kanban Board",
      text: "Task management built for AI agent workflows. Assign, track, and ship from one drag-and-drop board.",
    },
    {
      icon: Users,
      title: "Team Access",
      text: "Role-based permissions for your whole team — owner, admin, member, or viewer. You control who sees what.",
    },
    {
      icon: Activity,
      title: "Activity Feed",
      text: "A live audit log of everything your agents do. Filter by agent, task, or event type.",
    },
    {
      icon: Lock,
      title: "Secure Connection",
      text: "AES-GCM encrypted connection to your OpenClaw instance. Your credentials never leave your stack.",
    },
  ];

  const steps = [
    {
      n: "01",
      icon: Terminal,
      title: "Connect your OpenClaw instance",
      text: "Link your existing OpenClaw gateway to Synclaw. Takes about 5 minutes with our guided connection flow.",
    },
    {
      n: "02",
      icon: Calendar,
      title: "Book a 30-min setup call",
      text: "Get on a call with me directly. I'll make sure everything is configured exactly right for your workflow.",
    },
    {
      n: "03",
      icon: Monitor,
      title: "Run your mission control",
      text: "Your agents are now under full observation. Monitor, manage, and ship from one dashboard — anywhere.",
    },
  ];

  const pricingFeatures = [
    "Real-time agent monitoring",
    "Kanban task management",
    "Team access (up to 10 members)",
    "Full activity audit log",
    "Secure encrypted connection",
    "Founder-led 1-on-1 setup call",
  ];

  return (
    <div
      className="min-h-screen antialiased"
      style={{ backgroundColor: LP.bg, color: LP.text }}
    >
      {/* ── Ambient background ─────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Violet ambient blob — top left */}
        <div
          className="lp-blob-1 absolute"
          style={{
            left: "-15%",
            top: "-10%",
            width: "50rem",
            height: "50rem",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)",
          }}
        />
        {/* Violet ambient blob — right center */}
        <div
          className="lp-blob-2 absolute"
          style={{
            right: "-8%",
            top: "25%",
            width: "36rem",
            height: "36rem",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* ── Header ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{
          borderColor: LP.border,
          backgroundColor: "rgba(8,10,15,0.88)",
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: LP.accentDim }}
            >
              <Zap className="h-4 w-4" style={{ color: LP.accent }} />
            </div>
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: LP.text }}
            >
              {brand.product.name}
            </span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: LP.muted }}
            >
              {brand.marketing.signInLabel}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: LP.accent }}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {brand.marketing.primaryCtaLabel}
              </span>
              <span className="sm:hidden">Book a Call</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* ── Hero ───────────────────────────────────────── */}
        <section className="lp-reveal grid items-center gap-12 pb-20 pt-24 sm:pt-32 lg:grid-cols-[1fr_0.95fr] lg:gap-16">
          {/* Left: Copy */}
          <div>
            {/* Badge */}
            <div
              className="mb-7 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-medium"
              style={{
                borderColor: LP.border,
                backgroundColor: LP.surface,
                color: LP.muted,
              }}
            >
              <span
                className="lp-pulse h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: LP.emerald }}
              />
              {brand.marketing.trustBadge}
            </div>

            {/* Headline */}
            <h1
              className="max-w-2xl text-[clamp(2.4rem,5.5vw,3.8rem)] font-bold leading-[1.06] tracking-[-0.03em]"
              style={{ color: LP.text }}
            >
              {brand.marketing.heroHeadline}{" "}
              <span style={{ color: LP.accent }}>
                {brand.marketing.heroAccent}
              </span>
              .
            </h1>

            {/* Sub */}
            <p
              className="mt-6 max-w-lg text-base leading-relaxed sm:text-lg"
              style={{ color: LP.muted }}
            >
              {brand.marketing.heroSubheadline}
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: LP.accent }}
              >
                <Calendar className="h-4 w-4" />
                {brand.marketing.primaryCtaLabel}
                <ArrowRight className="lp-arrow h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ borderColor: LP.border, color: LP.muted }}
              >
                {brand.marketing.secondaryCtaLabel}
              </a>
            </div>

            {/* Benefit bullets */}
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {brand.marketing.benefitBullets.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: LP.muted }}
                >
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: LP.emerald }}
                  />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Dashboard carousel mockup */}
          <HeroDashboardCarousel palette={LP} />
        </section>

        {/* ── Proof strip ────────────────────────────────── */}
        <section
          className="lp-reveal border-y py-8"
          style={{ borderColor: LP.border }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {brand.marketing.proofStrip.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border px-5 py-4"
                style={{
                  borderColor: LP.border,
                  backgroundColor: LP.surface,
                }}
              >
                <p
                  className="text-lg font-semibold tracking-tight"
                  style={{ color: LP.text }}
                >
                  {s.value}
                </p>
                <p className="mt-0.5 text-sm" style={{ color: LP.muted }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust / Compliance strip ───────────────────── */}
        <section className="lp-reveal py-8">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {[
              {
                icon: ShieldCheck,
                label: "GDPR Compliant",
                color: LP.emerald,
              },
              {
                icon: ShieldCheck,
                label: "SOC 2 Certified",
                color: LP.accent,
              },
              {
                icon: Lock,
                label: "AES-256 Encrypted",
                color: LP.muted,
              },
            ].map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium"
                style={{
                  borderColor: LP.border,
                  backgroundColor: LP.surface,
                  color: LP.muted,
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                {label}
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ───────────────────────────────── */}
        <section id="how-it-works" className="lp-reveal pb-24 pt-16">
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: LP.accent }}
          >
            {brand.marketing.howItWorksTitle}
          </p>
          <h2
            className="mb-4 text-3xl font-bold tracking-[-0.025em] sm:text-4xl"
            style={{ color: LP.text }}
          >
            Simple to start.
            <br />
            Personal by design.
          </h2>
          <p
            className="mb-16 max-w-md text-base leading-relaxed"
            style={{ color: LP.muted }}
          >
            {brand.marketing.operatorFlowBody}
          </p>

          <div className="grid gap-10 sm:grid-cols-3">
            {steps.map(({ n, icon: Icon, title, text }) => (
              <div key={n}>
                <div
                  className="mb-5 text-5xl font-bold tabular-nums leading-none tracking-[-0.04em]"
                  style={{
                    color: LP.accentDim,
                    WebkitTextStroke: `1px ${LP.accentGlow}`,
                  }}
                >
                  {n}
                </div>
                <div
                  className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: LP.accentDim }}
                >
                  <Icon className="h-4 w-4" style={{ color: LP.accent }} />
                </div>
                <h3
                  className="mb-2 text-base font-semibold"
                  style={{ color: LP.text }}
                >
                  {title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: LP.muted }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────── */}
        <section className="lp-reveal pb-24">
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: LP.accent }}
          >
            {brand.marketing.creativeTitle}
          </p>
          <h2
            className="mb-12 text-3xl font-bold tracking-[-0.025em] sm:text-4xl"
            style={{ color: LP.text }}
          >
            Everything you need.
            <br />
            Nothing you don&apos;t.
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl border p-5"
                style={{
                  borderColor: LP.border,
                  backgroundColor: LP.surface,
                }}
              >
                <div
                  className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: LP.accentDim }}
                >
                  <Icon className="h-4 w-4" style={{ color: LP.accent }} />
                </div>
                <h3
                  className="mb-1.5 text-sm font-semibold"
                  style={{ color: LP.text }}
                >
                  {title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: LP.muted }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────── */}
        <section id="pricing" className="lp-reveal pb-24">
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: LP.accent }}
          >
            {brand.marketing.pricingKicker}
          </p>
          <h2
            className="mb-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl"
            style={{ color: LP.text }}
          >
            {brand.marketing.pricingHeadline}
          </h2>
          <p className="mb-12 text-base" style={{ color: LP.muted }}>
            One plan. Two billing cycles. All features included.
          </p>

          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            {/* Monthly */}
            <div
              className="rounded-2xl border p-7"
              style={{
                borderColor: LP.border,
                backgroundColor: LP.surface,
              }}
            >
              <p className="text-sm font-medium" style={{ color: LP.muted }}>
                Monthly
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span
                  className="text-[2.5rem] font-bold leading-none tracking-[-0.03em]"
                  style={{ color: LP.text }}
                >
                  $15
                </span>
                <span className="text-sm" style={{ color: LP.muted }}>
                  / mo
                </span>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: LP.dim }}>
                Try before committing — cancel anytime
              </p>

              <Link
                href="/login"
                className="mt-6 block w-full rounded-xl border px-4 py-3 text-center text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ borderColor: LP.borderStrong, color: LP.muted }}
              >
                {brand.marketing.pricingCtaLabel}
              </Link>

              <ul className="mt-7 space-y-3">
                {pricingFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm"
                    style={{ color: LP.muted }}
                  >
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: LP.emerald }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Yearly — highlighted */}
            <div
              className="relative rounded-2xl border p-7"
              style={{
                borderColor: LP.accentGlow,
                backgroundColor: LP.accentDim,
                boxShadow: `0 0 0 1px ${LP.accentDim}, 0 20px 50px rgba(99,102,241,0.12)`,
              }}
            >
              {/* Best value badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span
                  className="rounded-full px-3.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: LP.accent }}
                >
                  Best value — save 45%
                </span>
              </div>

              <p className="text-sm font-medium" style={{ color: LP.muted }}>
                Yearly
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span
                  className="text-[2.5rem] font-bold leading-none tracking-[-0.03em]"
                  style={{ color: LP.text }}
                >
                  $99
                </span>
                <span className="text-sm" style={{ color: LP.muted }}>
                  / yr
                </span>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: LP.accent }}>
                That&apos;s $8.25/mo — locked in as long as you stay
              </p>

              <Link
                href="/login"
                className="mt-6 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: LP.accent }}
              >
                {brand.marketing.pricingCtaLabel}
              </Link>

              <ul className="mt-7 space-y-3">
                {pricingFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm"
                    style={{ color: LP.muted }}
                  >
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: LP.emerald }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 text-xs" style={{ color: LP.dim }}>
            Early access pricing is locked in as long as you stay subscribed. No
            contracts — cancel anytime.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {(
              [
                { icon: ShieldCheck, label: "GDPR Compliant", color: LP.emerald },
                { icon: ShieldCheck, label: "SOC 2 Certified", color: LP.accent },
                { icon: Lock, label: "AES-256 Encrypted", color: LP.dim },
              ] as { icon: typeof ShieldCheck; label: string; color: string }[]
            ).map(({ icon: Icon, label, color }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-[11px]"
                style={{ color: LP.dim }}
              >
                <Icon className="h-3 w-3" style={{ color }} />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* ── Founder Promise ────────────────────────────── */}
        <section
          className="lp-reveal mb-24 rounded-2xl border p-8 sm:p-12"
          style={{
            borderColor: LP.accentGlow,
            backgroundColor: LP.accentDim,
          }}
        >
          <div className="max-w-xl">
            <p
              className="mb-2 text-xs font-semibold uppercase tracking-widest"
              style={{ color: LP.accent }}
            >
              {brand.marketing.operatorFlowTitle}
            </p>
            <h2
              className="mb-4 text-2xl font-bold tracking-[-0.025em] sm:text-3xl"
              style={{ color: LP.text }}
            >
              I&apos;ll personally get you set up.
            </h2>
            <p
              className="mb-8 text-base leading-relaxed"
              style={{ color: LP.muted }}
            >
              Every new customer gets a 1-on-1 setup call with me directly.
              We&apos;ll connect your OpenClaw instance, configure your agents,
              and make sure everything runs exactly the way you want it. No
              ticket queue. No onboarding doc maze. Just a real conversation and
              a working setup.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: LP.accent }}
            >
              <Calendar className="h-4 w-4" />
              {brand.marketing.primaryCtaLabel}
              <ArrowRight className="lp-arrow h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────── */}
        <section className="lp-reveal pb-28 text-center">
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: LP.accent }}
          >
            {brand.marketing.finalCtaKicker}
          </p>
          <h2
            className="mx-auto mb-4 max-w-lg text-3xl font-bold tracking-[-0.025em] sm:text-4xl"
            style={{ color: LP.text }}
          >
            {brand.marketing.finalCtaHeadline}
          </h2>
          <p
            className="mx-auto mb-10 max-w-md text-base leading-relaxed"
            style={{ color: LP.muted }}
          >
            {brand.marketing.finalCtaBody}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: LP.accent }}
            >
              <Calendar className="h-4 w-4" />
              {brand.marketing.primaryCtaLabel}
              <ArrowRight className="lp-arrow h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="rounded-xl border px-7 py-3.5 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ borderColor: LP.border, color: LP.muted }}
            >
              {brand.marketing.signInLabel}
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer
        className="border-t py-8 text-center"
        style={{ borderColor: LP.border }}
      >
        <p className="text-xs" style={{ color: LP.dim }}>
          © {new Date().getFullYear()} Synclaw — Built for OpenClaw users.
        </p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <Link
            href="/privacy"
            className="text-[11px] transition-opacity hover:opacity-70"
            style={{ color: LP.dim }}
          >
            Privacy Policy
          </Link>
          <span style={{ color: LP.border }}>·</span>
          <span
            className="inline-flex items-center gap-1 text-[11px]"
            style={{ color: LP.dim }}
          >
            <ShieldCheck className="h-3 w-3" style={{ color: LP.emerald }} />
            GDPR Compliant
          </span>
          <span style={{ color: LP.border }}>·</span>
          <span
            className="inline-flex items-center gap-1 text-[11px]"
            style={{ color: LP.dim }}
          >
            <ShieldCheck className="h-3 w-3" style={{ color: LP.accent }} />
            SOC 2 Certified
          </span>
        </div>
      </footer>

      {/* ── Animations ─────────────────────────────────── */}
      <style jsx global>{`
        .lp-reveal {
          opacity: 0;
          transform: translateY(18px);
          animation: lpReveal 580ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @supports (animation-timeline: view()) {
          .lp-reveal {
            opacity: 1;
            transform: none;
            animation: lpReveal 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
            animation-timeline: view();
            animation-range: entry 8% cover 28%;
          }
        }

        @keyframes lpReveal {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes lpBlob1 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -40px) scale(1.05);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.97);
          }
        }

        @keyframes lpBlob2 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-25px, 30px) scale(1.03);
          }
          66% {
            transform: translate(15px, -25px) scale(0.98);
          }
        }

        @keyframes lpArrow {
          0%,
          100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(4px);
          }
        }

        @keyframes lpFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes lpPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }

        .lp-blob-1 {
          animation: lpBlob1 16s ease-in-out infinite;
        }
        .lp-blob-2 {
          animation: lpBlob2 20s ease-in-out infinite;
        }
        .lp-arrow {
          animation: lpArrow 1.8s ease-in-out infinite;
        }
        .lp-float {
          animation: lpFloat 7s ease-in-out infinite;
        }
        .lp-pulse {
          animation: lpPulse 2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-blob-1,
          .lp-blob-2,
          .lp-arrow,
          .lp-float,
          .lp-pulse,
          .lp-reveal {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
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
