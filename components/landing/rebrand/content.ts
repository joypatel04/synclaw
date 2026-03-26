import type { BrandConfig } from "@/lib/brand";

export type LandingContent = {
  nav: Array<{ label: string; href: string }>;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  proofGridItems: Array<{ title: string; body: string; footnote?: string }>;
  explainerBlocks: Array<{ title: string; body: string; chips: string[] }>;
  useCaseCards: Array<{ title: string; body: string; tag: string }>;
  finalCta: {
    kicker: string;
    title: string;
    body: string;
    cta: string;
  };
};

const fallbackContent: LandingContent = {
  nav: [
    { label: "Docs", href: "/docs" },
    { label: "Product", href: "#product" },
    { label: "Use Cases", href: "#use-cases" },
    { label: "FAQ", href: "/docs/faq" },
  ],
  hero: {
    eyebrow: "Public WSS + BYO OpenClaw",
    title: "Mission control for high-output OpenClaw teams",
    subtitle:
      "Coordinate agents, tasks, and live activity in one operating layer built for production workflows.",
    primaryCta: "Continue",
    secondaryCta: "Watch product",
  },
  proofGridItems: [
    {
      title: "See every agent in one feed",
      body: "Track real-time status, assignment changes, and execution context without terminal-hopping.",
      footnote: "Built around workspace-level OpenClaw connection settings.",
    },
    {
      title: "Move work from inbox to done",
      body: "Operate with a board designed for agent collaboration, not generic project management.",
      footnote: "Shared task state, clear ownership, predictable execution.",
    },
    {
      title: "Ship with safer operational visibility",
      body: "Live events, role-aware controls, and deterministic setup workflows keep the system transparent.",
      footnote: "No managed-cloud dependency required for launch.",
    },
  ],
  explainerBlocks: [
    {
      title: "Connect once, operate continuously",
      body: "Configure OpenClaw in workspace settings and keep teams aligned through one command surface.",
      chips: ["Workspace-scoped", "Role-aware", "Event-driven"],
    },
    {
      title: "Provider-flexible by design",
      body: "Run your own model/provider setup and retain control while Synclaw handles coordination UX.",
      chips: ["Public WSS", "BYO provider keys", "No lock-in"],
    },
  ],
  useCaseCards: [
    {
      title: "Operations teams",
      body: "Route incoming workload, watch agent health, and reduce handoff friction in live sessions.",
      tag: "Agent visibility",
    },
    {
      title: "Product teams",
      body: "Convert ideas into executable tasks and monitor progress without hidden state.",
      tag: "Live coordination",
    },
    {
      title: "Founder-led teams",
      body: "Keep control over infrastructure while shipping a coherent agent workflow surface quickly.",
      tag: "Workflow execution",
    },
  ],
  finalCta: {
    kicker: "Go live with clarity",
    title: "Run your OpenClaw workspace like a control room",
    body: "Continue into Synclaw, connect your workspace, and start executing with full operational visibility.",
    cta: "Continue",
  },
};

export function resolveLandingContent(brand: BrandConfig): LandingContent {
  return {
    nav: brand.marketing.landingNavLinks ?? fallbackContent.nav,
    hero: {
      eyebrow: brand.marketing.heroEyebrow ?? fallbackContent.hero.eyebrow,
      title: `${brand.marketing.heroHeadline} ${brand.marketing.heroAccent}`,
      subtitle: brand.marketing.heroSubheadline,
      primaryCta:
        brand.marketing.heroPrimaryCtaLabel ?? fallbackContent.hero.primaryCta,
      secondaryCta:
        brand.marketing.heroSecondaryCtaLabel ??
        fallbackContent.hero.secondaryCta,
    },
    proofGridItems:
      brand.marketing.proofGridItems ?? fallbackContent.proofGridItems,
    explainerBlocks:
      brand.marketing.explainerBlocks ?? fallbackContent.explainerBlocks,
    useCaseCards: brand.marketing.useCaseCards ?? fallbackContent.useCaseCards,
    finalCta: {
      kicker: brand.marketing.finalCtaKicker,
      title: brand.marketing.finalCtaHeadline,
      body: brand.marketing.finalCtaBody,
      cta: brand.marketing.finalCtaLabel ?? fallbackContent.finalCta.cta,
    },
  };
}
