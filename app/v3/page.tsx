"use client";

import Link from "next/link";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Cable,
  Compass,
  Crown,
  Flame,
  Layers3,
  Sparkles,
} from "lucide-react";
import { brand } from "@/lib/brand";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
});

const pillars = [
  {
    title: "Command Layer",
    text: "Define priorities, ownership, and review standards before execution starts.",
    icon: Layers3,
  },
  {
    title: "OpenClaw Runtime",
    text: "Agent sessions execute scoped missions with traceable lifecycle events.",
    icon: Bot,
  },
  {
    title: "MCP Bridge",
    text: "Tool actions remain structured, auditable, and bounded for quality output.",
    icon: Cable,
  },
] as const;

const stats = [
  { label: "Operators online", value: "14" },
  { label: "Active missions", value: "37" },
  { label: "Weekly shipped", value: "128" },
] as const;

export default function LandingV3Page() {
  return (
    <div className={`${jakarta.className} relative min-h-screen overflow-x-hidden bg-[#0b0908] text-[#f8f2ea]`}>
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_16%_12%,rgba(229,140,75,0.22),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(210,101,44,0.16),transparent_30%),linear-gradient(to_bottom,#0b0908,#110d0b_40%,#140f0d)]" />
      <div className="v3-mesh pointer-events-none fixed inset-0 -z-10" />

      <header className="sticky top-0 z-40 border-b border-[#3a2a20] bg-[#0b0908]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#b96e3f]/50 bg-[#2b1a12] text-[#ffb07b]">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <p className={`${plexMono.className} text-xs uppercase tracking-[0.24em] text-[#ffb07b]`}>
                {brand.product.shortName}
              </p>
              <p className="text-xs text-[#c8b2a0]">Operator Atelier</p>
            </div>
          </div>

          <nav className={`${plexMono.className} hidden items-center gap-6 text-[11px] uppercase tracking-[0.2em] text-[#c39f86] md:flex`}>
            <a href="#system" className="hover:text-[#ffd3ae]">
              System
            </a>
            <a href="#positioning" className="hover:text-[#ffd3ae]">
              Positioning
            </a>
            <a href="#cta" className="hover:text-[#ffd3ae]">
              Launch
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-[#4a3124] bg-[#1b130f] px-3 py-2 text-sm text-[#f5dec8] transition hover:border-[#6d4836]"
            >
              {brand.marketing.signInLabel}
            </Link>
            <Link
              href="/login"
              className={`${plexMono.className} inline-flex items-center gap-2 rounded-lg border border-[#d8844c] bg-[#3a2114] px-3 py-2 text-sm text-[#ffd0a7] transition hover:bg-[#4b2b1a]`}
            >
              {brand.marketing.primaryCtaLabel}
              <ArrowRight className="v3-arrow h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <section className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className={`${plexMono.className} mb-4 text-xs uppercase tracking-[0.32em] text-[#f9a970]`}>
              built for high-trust execution
            </p>
            <h1 className="max-w-3xl text-[clamp(2.4rem,6vw,5.8rem)] font-extrabold leading-[0.92] tracking-tight">
              Elegant command
              <span className="block text-[#ffb07b]">for modern operators</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#d4beab]">
              {brand.product.name} combines mission planning, agent orchestration, and review discipline into one premium system.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className={`${plexMono.className} inline-flex items-center gap-2 rounded-xl border border-[#d8844c] bg-[#3a2114] px-5 py-3 text-sm text-[#ffd0a7] transition hover:bg-[#4b2b1a]`}
              >
                Enter operator mode
                <ArrowRight className="v3-arrow h-4 w-4" />
              </Link>
              <Link
                href="/v2"
                className="rounded-xl border border-[#4a3124] bg-[#1a120e] px-5 py-3 text-sm font-semibold text-[#f3dbc5] transition hover:border-[#6d4836]"
              >
                Compare with V2
              </Link>
            </div>

            <div className="mt-8 grid gap-2">
              {[
                "Human + agent workflow under one governance model",
                "No fragile black-box automation decisions",
                "Clear review gates before output is marked shipped",
              ].map((item) => (
                <div
                  key={item}
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#412a1f] bg-[#1a120e] px-3 py-2 text-sm text-[#dec8b4]"
                >
                  <BadgeCheck className="h-4 w-4 text-[#ffb07b]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="v3-console rounded-2xl border border-[#4a2f23] bg-[#15100d] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.55)]">
            <div className="mb-4 flex items-center justify-between border-b border-[#3b261c] pb-3">
              <p className={`${plexMono.className} text-xs uppercase tracking-[0.18em] text-[#c89f82]`}>
                live control console
              </p>
              <span className={`${plexMono.className} rounded-full border border-[#8e5433] bg-[#2a1911] px-2 py-1 text-[11px] text-[#ffbc8e]`}>
                stable
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-[#3f281d] bg-[#1a120e] p-3">
                  <p className="text-sm text-[#d5b8a0]">{s.label}</p>
                  <p className={`${plexMono.className} mt-1 text-xl text-[#ffbe91]`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[#3f281d] bg-[#1a120e] p-4">
              <p className={`${plexMono.className} text-xs uppercase tracking-[0.2em] text-[#b69075]`}>
                active operator rail
              </p>
              <div className="mt-3 space-y-2">
                <p className={`${plexMono.className} text-sm text-[#ffbf92]`}>$ dispatch mission --priority high</p>
                <p className="text-sm text-[#c9ac95]">{"> openclaw runtime synced"}</p>
                <p className="text-sm text-[#c9ac95]">{"> mcp tools attached"}</p>
                <p className="text-sm text-[#c9ac95]">{"> review queue waiting: 3 items"}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="system" className="mt-20">
          <div className="mb-6">
            <p className={`${plexMono.className} text-xs uppercase tracking-[0.28em] text-[#f4a872]`}>System architecture</p>
            <h2 className="mt-2 text-4xl font-bold tracking-tight">How execution flows</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {pillars.map((p) => (
              <article key={p.title} className="rounded-2xl border border-[#472f23] bg-[#15100d] p-6">
                <div className="mb-4 inline-flex rounded-lg border border-[#5b3b2c] bg-[#241912] p-3 text-[#ffb07b]">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="text-2xl font-bold">{p.title}</h3>
                <p className="mt-3 text-[#d2baa8]">{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="positioning" className="mt-20 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-[#472f23] bg-[#15100d] p-6">
            <p className={`${plexMono.className} mb-2 text-xs uppercase tracking-[0.22em] text-[#f1a66f]`}>Positioning</p>
            <h3 className="text-3xl font-bold">Premium control plane</h3>
            <p className="mt-3 text-[#d2baa8]">
              Not another generic PM board. This is a workflow system for operators managing both humans and agents.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["OpenClaw-native", "MCP-ready", "Convex-backed", "Role-aware"].map((t) => (
                <span key={t} className={`${plexMono.className} rounded-md border border-[#5b3b2c] bg-[#241912] px-2.5 py-1 text-xs text-[#edc6a5]`}>
                  {t}
                </span>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-[#472f23] bg-[#15100d] p-6">
            <p className={`${plexMono.className} mb-2 text-xs uppercase tracking-[0.22em] text-[#f1a66f]`}>Go-to-market</p>
            <h3 className="text-3xl font-bold">Launch before billing</h3>
            <p className="mt-3 text-[#d2baa8]">
              Acquire first users with trial workflow now, then layer Razorpay billing once account setup and plans are live.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-[#e4ccb6]">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-[#f3a86f]" />
                Operator onboarding path is ready
              </div>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-[#f3a86f]" />
                Positioning and landing experimentation in progress
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#f3a86f]" />
                Billing hooks can be switched on later
              </div>
            </div>
          </article>
        </section>

        <section id="cta" className="mt-20 rounded-2xl border border-[#5b3b2c] bg-[#241711] p-8">
          <h2 className="text-[clamp(2rem,4.4vw,4rem)] font-extrabold leading-[1] tracking-tight">
            Ready to test this direction?
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[#e0c8b2]">
            Use V3 for warm luxury positioning, V2 for technical neon direction, and keep whichever converts better.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className={`${plexMono.className} inline-flex items-center gap-2 rounded-xl border border-[#d8844c] bg-[#3a2114] px-5 py-3 text-sm text-[#ffd0a7] transition hover:bg-[#4b2b1a]`}
            >
              Start now
              <ArrowRight className="v3-arrow h-4 w-4" />
            </Link>
            <Link
              href="/settings/billing"
              className="rounded-xl border border-[#6d4836] bg-[#2b1b13] px-5 py-3 text-sm font-semibold text-[#f6deca] transition hover:border-[#8f5f46]"
            >
              Billing status
            </Link>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @keyframes v3Float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes v3Arrow {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        .v3-mesh {
          background-image:
            linear-gradient(rgba(145, 91, 56, 0.24) 1px, transparent 1px),
            linear-gradient(90deg, rgba(145, 91, 56, 0.24) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.9), transparent 84%);
        }
        .v3-console {
          animation: v3Float 8s ease-in-out infinite;
        }
        .v3-arrow {
          animation: v3Arrow 1.3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
