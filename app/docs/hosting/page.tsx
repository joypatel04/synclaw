import {
  ArrowRight,
  BookOpenCheck,
  Cloud,
  HardDrive,
  Server,
  Settings2,
  Webhook,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import {
  PublicDocsCard,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

const sections = [
  {
    href: "/docs/hosting/cloud",
    title: "Public WSS hosting guide",
    description: "Fastest path for OSS launch with BYO OpenClaw.",
    icon: Cloud,
  },
  {
    href: "/docs/hosting/self-hosted",
    title: "Self-hosted overview",
    description: "Infra ownership model and end-to-end setup flow.",
    icon: HardDrive,
  },
  {
    href: "/docs/hosting/self-hosted/convex",
    title: "Configure Convex",
    description: "Auth, deployments, env vars, and runtime wiring.",
    icon: Server,
  },
  {
    href: "/docs/hosting/self-hosted/mcp",
    title: "Configure MCP/OpenClaw",
    description: "Gateway + MCP integration and verification.",
    icon: Wrench,
  },
  {
    href: "/docs/hosting/self-hosted/files-bridge",
    title: "OpenClaw Files Bridge",
    description:
      "Remote workspace file browsing/editing via Dockerized bridge.",
    icon: HardDrive,
  },
  {
    href: "/docs/hosting/environment",
    title: "Environment reference",
    description: "Every required env var and what it controls.",
    icon: Settings2,
  },
  {
    href: "/docs/hosting/webhooks",
    title: "Webhook automation",
    description: "Inbound integrations, mapping rules, security, and retries.",
    icon: Webhook,
  },
  {
    href: "/docs/hosting/troubleshooting",
    title: "Troubleshooting",
    description: "Common issues and exact resolution paths.",
    icon: BookOpenCheck,
  },
] as const;

export default function HostingOverviewPage() {
  return (
    <PublicDocsShell
      title="Hosting Guide"
      description="Production-style setup docs for Public WSS and Self-hosted deployments."
      iconName="Server"
    >
      <PublicDocsCard title="Use this guide">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Choose Public WSS or Self-hosted based on operational ownership.
          </li>
          <li>Follow the step-by-step guide in order.</li>
          <li>Run verification checks before moving to production.</li>
          <li>
            Use troubleshooting pages when behavior differs from expected
            output.
          </li>
        </ol>
      </PublicDocsCard>

      <PublicDocsCard title="Sections">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-accent-orange/40 hover:bg-bg-hover"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                  <section.icon className="h-4 w-4 text-accent-orange" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {section.title}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {section.description}
                  </p>
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-orange">
                Open <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
