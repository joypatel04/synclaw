import { PlayCircle } from "lucide-react";
import Image from "next/image";
import { HeroDashboardCarousel } from "@/components/landing/HeroDashboardCarousel";
import type { BrandConfig } from "@/lib/brand";
import { landingTheme, toHeroCarouselPalette } from "@/lib/landingTheme";
import type { LandingContent } from "../content";
import { GlowButton } from "../GlowButton";
import { MetricTile } from "../MetricTile";
import { SectionFrame } from "../SectionFrame";

export function HeroDark({
  brand,
  content,
}: {
  brand: BrandConfig;
  content: LandingContent;
}) {
  return (
    <SectionFrame className="landing-reveal pt-18 sm:pt-20 lg:pt-20">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_0.95fr] lg:gap-14">
        <div>
          <div className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3">
            <Image
              src="/brand/synclaw-logo-20260329.png"
              alt="SynClaw logo"
              width={44}
              height={44}
              className="h-11 w-11"
            />
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.16em] text-white/45">
                OpenClaw Mission Control
              </p>
              <p className="text-[26px] font-semibold tracking-tight text-white/90 landing-display">
                SynClaw
              </p>
            </div>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">
            {content.hero.eyebrow}
          </p>
          <h1 className="mt-5 max-w-3xl text-[clamp(2.6rem,5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-[#E6EAFF] landing-display">
            {content.hero.title}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/60">
            {content.hero.subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <GlowButton href="/login" label={content.hero.primaryCta} />
            <a
              href="#product"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/75 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:text-white"
            >
              <PlayCircle className="h-4 w-4" />
              {content.hero.secondaryCta}
            </a>
          </div>

          <div className="mt-10 grid gap-3 sm:max-w-xl sm:grid-cols-3">
            {brand.marketing.proofStrip.map((item) => (
              <MetricTile
                key={item.label}
                label={item.label}
                value={item.value}
                hint="live"
              />
            ))}
          </div>
        </div>

        <HeroDashboardCarousel palette={toHeroCarouselPalette(landingTheme)} />
      </div>
    </SectionFrame>
  );
}
