import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";

export const HELP_DOCS = {
  gettingStarted: {
    href: "/help/getting-started",
    title: "Getting Started",
    description:
      "Choose your path, run the baseline setup, and verify your first workspace.",
    filePath: "docs/product/OVERVIEW.md",
  },
  cloud: {
    href: "/help/cloud",
    title: "Cloud Setup",
    description:
      "Fastest path for teams that want managed operations and minimum setup.",
    filePath: "docs/product/CLOUD_GET_STARTED.md",
  },
  selfHosted: {
    href: "/help/self-hosted",
    title: "Self-hosted Setup",
    description:
      "Detailed runbook for deploying Synclaw + Convex + OpenClaw on your own infra.",
    filePath: "docs/product/SELF_HOSTED_GUIDE.md",
  },
  pricing: {
    href: "/help/pricing",
    title: "Pricing",
    description: "Cloud vs self-hosted packaging and support positioning.",
    filePath: "docs/product/PRICING.md",
  },
  faq: {
    href: "/help/faq",
    title: "FAQ",
    description: "Direct answers for common setup and operating questions.",
    filePath: "docs/product/FAQ.md",
  },
} as const;

export type HelpDocSlug = keyof typeof HELP_DOCS;

export const readHelpDoc = cache(async (slug: HelpDocSlug) => {
  const target = HELP_DOCS[slug];
  return readFile(join(process.cwd(), target.filePath), "utf8");
});
