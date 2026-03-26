import type { LandingContent } from "../content";
import { SectionFrame } from "../SectionFrame";

export function UseCasesLight({ content }: { content: LandingContent }) {
  return (
    <div
      id="use-cases"
      className="bg-[var(--landing-light-base)] text-[var(--landing-light-text)]"
    >
      <SectionFrame className="landing-reveal pb-28">
        <div className="mb-10 flex items-end justify-between gap-4">
          <h3 className="text-[clamp(1.9rem,3.4vw,3rem)] font-semibold leading-tight tracking-[-0.025em] landing-display">
            Outcome-focused workflows
            <br />
            for every team shape
          </h3>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--landing-light-muted)]">
            Start with one workspace and scale execution with clear role
            boundaries and event visibility.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {content.useCaseCards.map((card) => (
            <article
              key={card.title}
              className="group rounded-3xl border border-[var(--landing-light-border)] bg-white/85 p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(17,25,55,0.12)]"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--landing-light-accent)]">
                {card.tag}
              </p>
              <h4 className="mt-3 text-2xl font-semibold tracking-tight">
                {card.title}
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-[var(--landing-light-muted)]">
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </SectionFrame>
    </div>
  );
}
