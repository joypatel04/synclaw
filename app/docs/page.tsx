import Link from "next/link";
import { ArrowRight, BookOpenText, Cloud, Coins, HardDrive, HelpCircle, Server } from "lucide-react";
import { brand } from "@/lib/brand";
import { PublicDocsCard, PublicDocsShell } from "@/app/docs/_components/PublicDocsShell";

const tracks = [
  {
    href: "/docs/hosting",
    title: "Hosting guide",
    description: "Detailed deployment docs like production doc portals.",
    icon: Server,
  },
  {
    href: "/docs/cloud",
    title: "Cloud setup",
    description: "Best for most users. Fast onboarding and managed operations.",
    icon: Cloud,
  },
  {
    href: "/docs/self-hosted",
    title: "Self-hosted setup",
    description: "Developer-grade setup with your own Convex and MCP infrastructure.",
    icon: HardDrive,
  },
  {
    href: "/docs/pricing",
    title: "Pricing model",
    description: "Cloud vs OSS packaging and support strategy.",
    icon: Coins,
  },
  {
    href: "/docs/faq",
    title: "FAQ",
    description: "Answers for deployment, support, and migration decisions.",
    icon: HelpCircle,
  },
] as const;

export default function PublicDocsOverviewPage() {
  return (
    <PublicDocsShell
      title="Public Documentation"
      description={`How to set up and use ${brand.product.name} (Cloud and Self-hosted).`}
      icon={BookOpenText}
    >
      <PublicDocsCard title="Choose your track">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tracks.map((track) => (
            <Link
              key={track.href}
              href={track.href}
              className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-accent-orange/40 hover:bg-bg-hover"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                  <track.icon className="h-4 w-4 text-accent-orange" />
                </div>
                <div>
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
      </PublicDocsCard>

      <PublicDocsCard title="Cloud vs Self-hosted">
        <ul className="list-disc space-y-2 pl-5">
          <li>Cloud is for speed, ease of use, and lower operational burden.</li>
          <li>Self-hosted is for teams that need infrastructure ownership and customization.</li>
          <li>Workflow philosophy stays the same in both models.</li>
          <li>For detailed steps, start at <code className="rounded bg-bg-primary px-1 py-0.5">/docs/hosting</code>.</li>
        </ul>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
