import { Sparkles } from "lucide-react";
import type { LandingContent } from "../content";
import { SectionFrame } from "../SectionFrame";

export function ExplainerLight({ content }: { content: LandingContent }) {
  return (
    <div className="bg-[var(--landing-light-base)] text-[var(--landing-light-text)]">
      <SectionFrame className="landing-reveal py-24 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--landing-light-dim)]">
              Synclaw + OpenClaw operating model
            </p>
            <h2 className="mt-4 text-[clamp(2.1rem,4.2vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.03em] landing-display">
              Synclaw gives OpenClaw teams
              <br />
              clean operations,
              <br />
              without hidden complexity
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--landing-light-muted)]">
              Synclaw is the operating layer between your OpenClaw runtime and
              your day-to-day execution workflow. Keep your infra choices, gain
              a focused operating interface.
            </p>
          </div>

          <div className="grid gap-4">
            {content.explainerBlocks.map((block) => (
              <article
                key={block.title}
                className="rounded-3xl border border-[var(--landing-light-border)] bg-[var(--landing-light-surface)] p-7 shadow-[0_16px_40px_rgba(17,25,55,0.06)]"
              >
                <div className="flex items-center gap-2 text-[var(--landing-light-accent)]">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
                    system block
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                  {block.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--landing-light-muted)]">
                  {block.body}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {block.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-[var(--landing-light-border)] bg-white/80 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--landing-light-dim)]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </SectionFrame>
    </div>
  );
}
