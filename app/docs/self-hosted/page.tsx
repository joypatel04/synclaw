import Link from "next/link";
import { ArrowRight, HardDrive } from "lucide-react";
import { PublicDocsCard, PublicDocsShell } from "@/app/docs/_components/PublicDocsShell";

export default function PublicSelfHostedDocsPage() {
  return (
    <PublicDocsShell
      title="Self-hosted Setup"
      description="Developer-grade setup with your own infrastructure."
      icon={HardDrive}
    >
      <PublicDocsCard title="Prerequisites">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your own Convex project and deployment environments.</li>
          <li>Your own OpenClaw gateway and MCP server setup.</li>
          <li>OAuth provider credentials and callback URL management.</li>
          <li>Ability to run and deploy Next.js + Convex applications.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Setup flow">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Clone repository and configure environment variables.</li>
          <li>Run `bunx convex dev` and `bun run dev` locally.</li>
          <li>Configure auth callbacks for local and production hosts.</li>
          <li>Set OpenClaw workspace config and verify agent heartbeat.</li>
          <li>Deploy app and backend to production.</li>
        </ol>
      </PublicDocsCard>

      <PublicDocsCard title="Need detailed step-by-step?">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/docs/hosting/self-hosted"
            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Self-hosted guide <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/docs/hosting/self-hosted/convex"
            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Convex setup <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/docs/hosting/self-hosted/mcp"
            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            MCP/OpenClaw setup <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
