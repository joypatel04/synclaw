"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Cloud,
  Coins,
  HardDrive,
  LifeBuoy,
  Shield,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { DocsCard, DocsFrame } from "@/app/help/_components/DocsFrame";

const tracks = [
  {
    href: "/help/cloud",
    title: "Cloud (recommended)",
    description: "Fastest path for non-technical users and teams that want managed infrastructure.",
    icon: Cloud,
  },
  {
    href: "/help/self-hosted",
    title: "Self-hosted OSS",
    description: "Developer-grade setup using your own Convex project and MCP server.",
    icon: HardDrive,
  },
  {
    href: "/help/pricing",
    title: "Pricing model",
    description: "How cloud plans compare to self-hosted and support options.",
    icon: Coins,
  },
  {
    href: "/help/faq",
    title: "FAQ",
    description: "Common migration, support, and deployment questions.",
    icon: LifeBuoy,
  },
] as const;

export default function GettingStartedPage() {
  return (
    <DocsFrame
      title="Product Documentation"
      description={`Setup and deployment guide for ${brand.product.name}.`}
      icon={BookOpen}
    >
      <div className="space-y-6">
        <DocsCard title="Choose your path">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tracks.map((track) => (
              <Link
                key={track.href}
                href={track.href}
                className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-accent-orange/40 hover:bg-bg-hover"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                    <track.icon className="h-4 w-4 text-accent-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{track.title}</p>
                    <p className="mt-1 text-xs text-text-muted">{track.description}</p>
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-orange">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </DocsCard>

        <DocsCard title="Decision model">
          <ul className="list-disc space-y-2 pl-5">
            <li>Use Cloud if you want the product to work immediately and avoid ops burden.</li>
            <li>Use Self-hosted if you need full infra control and can handle setup complexity.</li>
            <li>Keep feature parity in workflow; pricing differs by who operates the infrastructure.</li>
          </ul>
        </DocsCard>

        <DocsCard title="Security and operations">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border-default bg-bg-primary p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-dim">
                <Shield className="h-4 w-4 text-accent-orange" />
                Cloud
              </div>
              <p className="text-xs text-text-muted">
                Managed auth and infrastructure with streamlined onboarding.
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-primary p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-dim">
                <Shield className="h-4 w-4 text-accent-orange" />
                Self-hosted
              </div>
              <p className="text-xs text-text-muted">
                Full control over data plane and integrations, with full operational responsibility.
              </p>
            </div>
          </div>
        </DocsCard>
      </div>
    </DocsFrame>
  );
}

