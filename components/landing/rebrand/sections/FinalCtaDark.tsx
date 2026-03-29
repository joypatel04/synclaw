import type { LandingContent } from "../content";
import { GlowButton } from "../GlowButton";
import { SectionFrame } from "../SectionFrame";

export function FinalCtaDark({ content }: { content: LandingContent }) {
  return (
    <SectionFrame className="landing-reveal py-24 text-center sm:py-28">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
        {content.finalCta.kicker}
      </p>
      <h2 className="mx-auto mt-4 max-w-3xl text-[clamp(2.2rem,4.6vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white/92 landing-display">
        {content.finalCta.title}
      </h2>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/58">
        {content.finalCta.body}
      </p>
      <div className="mt-10 flex justify-center">
        <GlowButton
          href="/login"
          label={content.finalCta.cta}
          className="px-7 py-3"
        />
      </div>
    </SectionFrame>
  );
}
