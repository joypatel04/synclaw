import type { BrandConfig } from "@/lib/brand";
import { landingTheme } from "@/lib/landingTheme";
import type { LandingContent } from "./content";
import { LandingNav } from "./LandingNav";
import { ExplainerLight } from "./sections/ExplainerLight";
import { FinalCtaDark } from "./sections/FinalCtaDark";
import { FooterDark } from "./sections/FooterDark";
import { HeroDark } from "./sections/HeroDark";
import { ProofGridDark } from "./sections/ProofGridDark";
import { UseCasesLight } from "./sections/UseCasesLight";
import { WorkflowShowcaseDark } from "./sections/WorkflowShowcaseDark";
import { TransitionBand } from "./TransitionBand";

export function LandingShell({
  brand,
  content,
}: {
  brand: BrandConfig;
  content: LandingContent;
}) {
  return (
    <div className="landing-root min-h-screen bg-[var(--landing-dark-base)] text-[var(--landing-dark-text)] antialiased">
      <LandingNav links={content.nav} ctaLabel={content.hero.primaryCta} />

      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="landing-grid absolute inset-0 opacity-70" />
        <div className="landing-vignette absolute inset-0" />
        <div className="landing-orb-1 absolute" />
        <div className="landing-orb-2 absolute" />
      </div>

      <main>
        <HeroDark brand={brand} content={content} />
        <ProofGridDark content={content} />
        <WorkflowShowcaseDark />
        <TransitionBand direction="darkToLight" />
        <ExplainerLight content={content} />
        <UseCasesLight content={content} />
        <TransitionBand direction="lightToDark" />
        <FinalCtaDark content={content} />
      </main>

      <FooterDark brand={brand} />

      {/* Regular <style> tag (not styled-jsx) so this works as a server component */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS injection for landing theme */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --landing-dark-base: ${landingTheme.dark.base};
          --landing-dark-surface: ${landingTheme.dark.surface};
          --landing-dark-border: ${landingTheme.dark.border};
          --landing-dark-text: ${landingTheme.dark.text};
          --landing-dark-muted: ${landingTheme.dark.muted};
          --landing-dark-accent: ${landingTheme.dark.accent};
          --landing-light-base: ${landingTheme.light.base};
          --landing-light-surface: ${landingTheme.light.surface};
          --landing-light-border: ${landingTheme.light.border};
          --landing-light-text: ${landingTheme.light.text};
          --landing-light-muted: ${landingTheme.light.muted};
          --landing-light-dim: ${landingTheme.light.dim};
          --landing-light-accent: ${landingTheme.light.accent};
          --landing-transition-dark-light: ${landingTheme.transitions.darkToLight};
          --landing-transition-light-dark: ${landingTheme.transitions.lightToDark};
        }

        .landing-root {
          font-family: 'Satoshi', 'Inter', 'Avenir Next', 'Segoe UI', sans-serif;
        }

        .landing-display {
          font-family: 'Satoshi', 'Inter', 'Avenir Next', 'Segoe UI', sans-serif;
        }

        .landing-root .font-mono {
          font-family: 'Geist Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        }

        .landing-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 54px 54px;
          mask-image: radial-gradient(circle at 40% 12%, black 40%, transparent 90%);
        }

        .landing-vignette {
          background: radial-gradient(1200px 620px at 50% -10%, rgba(109,92,255,0.18), transparent 68%);
        }

        .landing-orb-1 {
          left: -8rem;
          top: 5rem;
          width: 34rem;
          height: 34rem;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(109,92,255,0.22) 0%, transparent 64%);
          filter: blur(18px);
          animation: landingFloatA 14s ease-in-out infinite;
        }

        .landing-orb-2 {
          right: -10rem;
          top: 40vh;
          width: 32rem;
          height: 32rem;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(16,200,149,0.1) 0%, transparent 66%);
          filter: blur(22px);
          animation: landingFloatB 17s ease-in-out infinite;
        }

        .landing-cta-glow {
          background: linear-gradient(90deg, #5B4DFF 0%, #7B68FF 55%, #5B4DFF 100%);
          box-shadow: 0 10px 26px rgba(109,92,255,0.4), 0 0 0 1px rgba(188,182,255,0.22);
        }

        .lp-float {
          animation: landingFloatShell 7s ease-in-out infinite;
        }

        .lp-pulse {
          animation: landingPulse 1.9s ease-in-out infinite;
        }

        .landing-reveal {
          opacity: 0;
          transform: translateY(24px);
          animation: landingReveal 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @supports (animation-timeline: view()) {
          .landing-reveal {
            opacity: 1;
            transform: none;
            animation: landingReveal 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
            animation-timeline: view();
            animation-range: entry 8% cover 26%;
          }
        }

        @keyframes landingReveal {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes landingFloatA {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(34px, -20px) scale(1.06);
          }
        }

        @keyframes landingFloatB {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-30px, 22px) scale(0.95);
          }
        }

        @keyframes landingFloatShell {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes landingPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.45;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-reveal,
          .landing-orb-1,
          .landing-orb-2,
          .lp-float,
          .lp-pulse {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      ` }} />
    </div>
  );
}
