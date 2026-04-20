import {
  ArrowRight,
  FolderTree,
  Server,
  Settings2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import {
  PublicDocsCard,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingSelfHostedOverviewPage() {
  return (
    <PublicDocsShell
      title="Self-hosted Hosting"
      description="Own your stack: app, Convex backend, and tool infrastructure."
      iconName="HardDrive"
    >
      <PublicDocsCard title="What you own in self-hosted mode">
        <ul className="list-disc space-y-2 pl-5">
          <li>Application deployment and runtime uptime.</li>
          <li>
            Convex environments, schema migrations, and auth configuration.
          </li>
          <li>OpenClaw gateway and MCP server connectivity.</li>
          <li>Incident response and compatibility maintenance.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Deployment sequence">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Set up Convex project and auth provider configuration.</li>
          <li>Run local dev and validate task/agent workflows.</li>
          <li>Configure OpenClaw + MCP integration.</li>
          <li>Deploy app and Convex to production.</li>
          <li>Run post-deploy verification and monitoring checks.</li>
        </ol>
      </PublicDocsCard>

      <PublicDocsCard title="Deep guides">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/docs/hosting/self-hosted/convex"
            className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-border-hover hover:bg-bg-hover"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                <Server className="h-4 w-4 text-text-secondary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Configure Convex
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Deployment, env, auth, and verification.
                </p>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
          <Link
            href="/docs/hosting/self-hosted/mcp"
            className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-border-hover hover:bg-bg-hover"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                <Wrench className="h-4 w-4 text-text-secondary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Configure MCP/OpenClaw
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Gateway, token, scopes, and tool verification.
                </p>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
          <Link
            href="/docs/hosting/environment"
            className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-border-hover hover:bg-bg-hover"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                <Settings2 className="h-4 w-4 text-text-secondary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Environment reference
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Variable-by-variable deployment reference.
                </p>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
          <Link
            href="/docs/hosting/self-hosted/files-bridge"
            className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-border-hover hover:bg-bg-hover"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                <FolderTree className="h-4 w-4 text-text-secondary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  OpenClaw Files Bridge
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Remote workspace file browser/editor via Docker bridge.
                </p>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
