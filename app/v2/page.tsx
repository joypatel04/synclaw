"use client";

import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Cable,
  CheckCircle2,
  CircleDotDashed,
  Coins,
  Github,
  Layers3,
  Sparkles,
  UserRound,
} from "lucide-react";
import { brand } from "@/lib/brand";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
});

const workbenchRows = [
  {
    project: "mission-board-runtime",
    summary: "Task lanes + operator review loops mapped to shipping cadence.",
    progress: 91,
    cadence: "Updated 1h ago",
  },
  {
    project: "openclaw-session-orchestration",
    summary: "Session lifecycle, retries, and stable run history tracking.",
    progress: 78,
    cadence: "Updated today",
  },
  {
    project: "mcp-tool-bridge",
    summary: "Controlled tool invocation contracts for predictable agent output.",
    progress: 72,
    cadence: "Updated today",
  },
  {
    project: "workspace-governance",
    summary: "Role boundaries, permission checks, and safer team operations.",
    progress: 86,
    cadence: "Updated yesterday",
  },
] as const;

const proofs = [
  "Operator-first workflow for solo founders and teams",
  "OpenClaw + MCP narrative explained in product language",
  "Execution traceability from task creation to shipped output",
] as const;

const useCases = [
  {
    title: "Creator Studio",
    body: "Plan and ship content with agent support while keeping review quality high.",
    icon: Sparkles,
  },
  {
    title: "Solo Founder OS",
    body: "Operate product, growth, and support from one mission board without context switching.",
    icon: UserRound,
  },
  {
    title: "Small Team Control",
    body: "Coordinate priorities with clear ownership and live operational visibility.",
    icon: BriefcaseBusiness,
  },
] as const;

const architecture = [
  {
    title: "Mission Board",
    body: "Human operators define priority, ownership, and review bar.",
    icon: Layers3,
  },
  {
    title: "OpenClaw Runtime",
    body: "Agents execute scoped tasks through sessionized workflows.",
    icon: Bot,
  },
  {
    title: "MCP Tool Rail",
    body: "External actions stay structured, auditable, and constrained.",
    icon: Cable,
  },
] as const;

export default function LandingV2Page() {
  return (
    <div className={`${spaceGrotesk.className} relative min-h-screen overflow-x-hidden bg-[#03070c] text-[#eaf2fb]`}>
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_18%_16%,rgba(0,238,177,0.16),transparent_30%),radial-gradient(circle_at_84%_20%,rgba(7,180,147,0.1),transparent_26%),linear-gradient(to_bottom,#03070c,#050b12_42%,#06101a)]" />
      <div className="v2-grid pointer-events-none fixed inset-0 -z-10" />
      <div className="v2-noise pointer-events-none fixed inset-0 -z-10 opacity-60" />

      <header className="sticky top-0 z-40 border-b border-[#10314a] bg-[#03070c]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#13b897]/45 bg-[#082920] text-[#13d7b0]">
              <CircleDotDashed className="h-4 w-4" />
            </div>
            <div>
              <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.28em] text-[#13d7b0]`}>
                {brand.product.shortName}
              </p>
              <p className="text-xs text-[#84a2c1]">{brand.product.tagline}</p>
            </div>
          </div>

          <nav className={`${ibmPlexMono.className} hidden items-center gap-6 text-[11px] uppercase tracking-[0.2em] text-[#7794b2] md:flex`}>
            <a className="hover:text-[#11dab2]" href="#how">
              How it works
            </a>
            <a className="hover:text-[#11dab2]" href="#workbench">
              Workbench
            </a>
            <a className="hover:text-[#11dab2]" href="#use-cases">
              Use cases
            </a>
            <a className="hover:text-[#11dab2]" href="#launch">
              Launch
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-[#20405e] bg-[#07111d] px-3 py-2 text-sm text-[#c2d4ea] transition hover:border-[#2f628d] hover:text-white"
            >
              {brand.marketing.signInLabel}
            </Link>
            <Link
              href="/login"
              className={`${ibmPlexMono.className} inline-flex items-center gap-2 rounded-lg border border-[#10cda5] bg-[#093327] px-3 py-2 text-sm text-[#0ff0bf] transition hover:bg-[#104437]`}
            >
              {brand.marketing.primaryCtaLabel}
              <ArrowRight className="v2-arrow h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <section className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className={`${ibmPlexMono.className} mb-5 text-xs uppercase tracking-[0.34em] text-[#16d7b0]`}>
              premium operator interface
            </p>
            <h1 className="max-w-3xl text-[clamp(2.4rem,6vw,5.6rem)] font-semibold leading-[0.95] tracking-tight">
              Build with agents.
              <span className="block text-[#10dbb4]">Ship with control.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#9fb7d0]">{brand.marketing.heroSubheadline}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className={`${ibmPlexMono.className} inline-flex items-center gap-2 rounded-xl border border-[#10cda5] bg-[#093327] px-5 py-3 text-sm text-[#0ff0bf] transition hover:bg-[#11473a]`}
              >
                Enter mission control
                <ArrowRight className="v2-arrow h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-[#1f3d59] bg-[#07111d] px-5 py-3 text-sm font-semibold text-[#bfd0e6] transition hover:border-[#2d5d85]"
              >
                View current landing
              </Link>
            </div>

            <div className="mt-8 grid gap-2">
              {proofs.map((item) => (
                <div
                  key={item}
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#18354f] bg-[#081220] px-3 py-2 text-sm text-[#99b3cf]"
                >
                  <CheckCircle2 className="h-4 w-4 text-[#12d4ac]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="v2-panel rounded-2xl border border-[#183a56] bg-[#050f1b] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.52)]">
            <div className="mb-4 flex items-center justify-between border-b border-[#112d45] pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28ca41]" />
              </div>
              <p className={`${ibmPlexMono.className} text-xs text-[#7492b0]`}>terminal://ops/live</p>
              <span className={`${ibmPlexMono.className} rounded-full border border-[#10cda5]/45 bg-[#082d23] px-2 py-1 text-[11px] text-[#0ff0bf]`}>
                live
              </span>
            </div>

            <div className={`${ibmPlexMono.className} space-y-3 text-sm`}>
              <div className="rounded-lg border border-[#15314a] bg-[#071322] p-3 text-[#11e2b8]">$ mission.sync --workspace=active</div>
              <div className="rounded-lg border border-[#15314a] bg-[#071322] p-3 text-[#8fb0ce]">{"> task lanes recalibrated"}</div>
              <div className="rounded-lg border border-[#15314a] bg-[#071322] p-3 text-[#8fb0ce]">{"> openclaw sessions healthy: 12/12"}</div>
              <div className="rounded-lg border border-[#15314a] bg-[#071322] p-3 text-[#8fb0ce]">{"> mcp tools attached: 9"}</div>
            </div>

            <div className="mt-4 rounded-xl border border-[#15314a] bg-[#061220] p-4">
              <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.2em] text-[#6f8cab]`}>Execution velocity</p>
              <div className="mt-3 space-y-3">
                {brand.marketing.snapshotRows.map((row, idx) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-[#a8bfd7]">{row.label}</span>
                      <span className={`${ibmPlexMono.className} text-[#10dbb4]`}>{row.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#102437]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(to_right,#0fd9b1,#0aa788)]"
                        style={{ width: `${62 + idx * 11}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="mt-20">
          <div className="mb-6">
            <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.28em] text-[#16d7b0]`}>How it works</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">From intent to shipped output</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {architecture.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[#173750] bg-[#06111e] p-6">
                <div className="mb-4 inline-flex rounded-lg border border-[#1d4462] bg-[#081a2b] p-3 text-[#11deb6]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-2xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-[#99b2cd]">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workbench" className="mt-20">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.28em] text-[#16d7b0]`}>Live workbench</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight">What is being built now</h2>
            </div>
            <span className={`${ibmPlexMono.className} hidden rounded-full border border-[#1f496a] bg-[#081a2b] px-3 py-1 text-xs text-[#8dadcc] sm:inline-flex`}>
              updated continuously
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#173750] bg-[#050f1b]">
            <div className={`${ibmPlexMono.className} grid grid-cols-[1.3fr_0.7fr_0.5fr] border-b border-[#123049] px-5 py-3 text-xs uppercase tracking-[0.18em] text-[#6b89a8]`}>
              <span>Module</span>
              <span>Progress</span>
              <span className="text-right">Pulse</span>
            </div>
            <div>
              {workbenchRows.map((row) => (
                <div
                  key={row.project}
                  className="grid grid-cols-1 gap-4 border-b border-[#10293f] px-5 py-5 last:border-b-0 md:grid-cols-[1.3fr_0.7fr_0.5fr]"
                >
                  <div>
                    <p className={`${ibmPlexMono.className} text-sm text-[#e5eef9]`}>{row.project}</p>
                    <p className="mt-1 text-sm text-[#92acce]">{row.summary}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 rounded-full bg-[#102638]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(to_right,#10ddb5,#0f9f82)]"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                    <span className={`${ibmPlexMono.className} w-10 text-right text-xs text-[#10ddb5]`}>{row.progress}%</span>
                  </div>
                  <p className={`${ibmPlexMono.className} text-right text-xs text-[#7f9fc2]`}>{row.cadence}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="use-cases" className="mt-20">
          <div className="mb-6">
            <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.28em] text-[#16d7b0]`}>Use cases</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">Who this is for</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {useCases.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[#173750] bg-[#06111e] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-[#1a5675]"
              >
                <div className="mb-4 inline-flex rounded-lg border border-[#1d4462] bg-[#081a2b] p-3 text-[#10d7af]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-2xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-[#99b2cd]">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="launch" className="mt-20 rounded-2xl border border-[#173750] bg-[#06101b] p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.28em] text-[#16d7b0]`}>Launch path</p>
              <h2 className="mt-2 text-[clamp(2rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-tight">
                Start now on workflow.
                <span className="block text-[#0fdeb5]">Billing can come next.</span>
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#92abcd]">
                You can onboard users, validate retention, and harden operations while Razorpay setup is in progress.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className={`${ibmPlexMono.className} inline-flex items-center gap-2 rounded-xl border border-[#10cda5] bg-[#093327] px-5 py-3 text-sm text-[#0ff0bf] transition hover:bg-[#11473a]`}
                >
                  Start trial flow
                  <ArrowRight className="v2-arrow h-4 w-4" />
                </Link>
                <Link
                  href="/settings/billing"
                  className="rounded-xl border border-[#1f3d59] bg-[#07111d] px-5 py-3 text-sm font-semibold text-[#bfd0e6] transition hover:border-[#2d5d85]"
                >
                  Billing status
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-[#173750] bg-[#081426] p-4">
                <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.2em] text-[#7895b4]`}>Stack</p>
                <p className="mt-2 text-[#d8e8fa]">Next.js + Convex + OpenClaw + MCP</p>
              </div>
              <div className="rounded-xl border border-[#173750] bg-[#081426] p-4">
                <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.2em] text-[#7895b4]`}>Positioning</p>
                <p className="mt-2 text-[#d8e8fa]">Operational control plane, not generic team chat + tasks.</p>
              </div>
              <div className="rounded-xl border border-[#173750] bg-[#081426] p-4">
                <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.2em] text-[#7895b4]`}>Billing</p>
                <p className="mt-2 flex items-center gap-2 text-[#d8e8fa]">
                  <Coins className="h-4 w-4 text-[#10d8b0]" />
                  Coming soon with Razorpay plan rails.
                </p>
              </div>
              <div className="rounded-xl border border-[#173750] bg-[#081426] p-4">
                <p className={`${ibmPlexMono.className} text-xs uppercase tracking-[0.2em] text-[#7895b4]`}>Social</p>
                <p className="mt-2 flex items-center gap-4 text-[#bfd0e6]">
                  <span className="inline-flex items-center gap-1.5">
                    <Github className="h-4 w-4" /> GitHub
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @keyframes v2Sweep {
          0% { transform: translateX(-120%); opacity: 0; }
          20% { opacity: 0.35; }
          100% { transform: translateX(220%); opacity: 0; }
        }
        @keyframes v2Arrow {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        @keyframes v2PanelFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .v2-grid {
          background-image:
            linear-gradient(rgba(16, 58, 85, 0.25) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 58, 85, 0.25) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.9), transparent 86%);
        }
        .v2-noise {
          background-image:
            repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.03) 0px,
              rgba(255, 255, 255, 0.03) 1px,
              transparent 1px,
              transparent 3px
            );
        }
        .v2-panel {
          position: relative;
          animation: v2PanelFloat 8s ease-in-out infinite;
        }
        .v2-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg, transparent 24%, rgba(23, 241, 193, 0.22) 48%, transparent 68%);
          transform: translateX(-120%);
          animation: v2Sweep 6.4s ease-in-out infinite;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        .v2-arrow {
          animation: v2Arrow 1.3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
