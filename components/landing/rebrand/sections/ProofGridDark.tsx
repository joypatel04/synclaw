import type { LandingContent } from "../content";
import { SectionFrame } from "../SectionFrame";

export function ProofGridDark({ content }: { content: LandingContent }) {
  return (
    <SectionFrame id="product" className="landing-reveal py-24">
      <div className="grid gap-[1px] overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-3">
        {content.proofGridItems.map((item) => (
          <article
            key={item.title}
            className="bg-[#0A0D17] p-8 md:min-h-[250px]"
          >
            <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-white/90">
              {item.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/58">
              {item.body}
            </p>
            {item.footnote ? (
              <p className="mt-7 font-mono text-xs uppercase tracking-[0.16em] text-white/36">
                {item.footnote}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </SectionFrame>
  );
}
