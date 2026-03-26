import {
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingTroubleshootingPage() {
  return (
    <PublicDocsShell
      title="Hosting Troubleshooting"
      description="Fast diagnosis for common auth, Convex, and OpenClaw/MCP issues."
      iconName="AlertTriangle"
    >
      <PublicDocsCard title="Auth callback stays on provider domain">
        <ul className="list-disc space-y-2 pl-5">
          <li>Verify provider callback URL matches expected route exactly.</li>
          <li>Check local vs production host mismatch in provider settings.</li>
          <li>Confirm app env vars are loaded in current runtime process.</li>
        </ul>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="What to compare exactly"
            code={`Expected callback:
https://<convex-site>.convex.site/api/auth/callback/github
https://<convex-site>.convex.site/api/auth/callback/google

Check:
1) OAuth app callback URL
2) .env.local AUTH_GITHUB_ID / AUTH_GITHUB_SECRET / AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
3) runtime restart after env edits`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title='Convex errors like "No matching routes found"'>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Run{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              bunx convex dev
            </code>{" "}
            and confirm functions are ready.
          </li>
          <li>Confirm correct deployment is set in local env.</li>
          <li>Re-run local server after env changes to pick up values.</li>
        </ul>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Recovery sequence"
            code={`1) stop both dev processes
2) start convex: bunx convex dev
3) wait for "functions ready"
4) start app: bun run dev
5) retry login flow`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="OpenClaw session or MCP tool failures">
        <ul className="list-disc space-y-2 pl-5">
          <li>Re-validate gateway URL/token/scopes in workspace settings.</li>
          <li>Check MCP endpoint health and network access rules.</li>
          <li>Run one minimal tool request to isolate schema/auth issues.</li>
          <li>
            Confirm failure appears in activity logs with actionable details.
          </li>
        </ul>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Minimal isolation test"
            code={`- create one test agent
- run one deterministic tool call
- verify:
  a) session starts
  b) tool request logged
  c) tool response logged
  d) task status updates`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title='Why "ws://" from "https://" fails'>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Browsers block insecure WebSocket (
            <code className="rounded bg-bg-primary px-1 py-0.5">ws://</code>)
            from secure pages.
          </li>
          <li>
            Use{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">wss://</code>{" "}
            for Public WSS setups.
          </li>
          <li>
            If OpenClaw must stay private, use Private Connector (advanced).
          </li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Device approval passes but scopes still fail">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Device approval and role/scope authorization are separate checks.
          </li>
          <li>
            Rotate/re-issue scopes to include required operator scopes for your
            workflow.
          </li>
          <li>
            Run Test again from Settings -&gt; OpenClaw after scope updates.
          </li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Hardened endpoint but handshake still failing">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Verify exact origin match in{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              allowedOrigins
            </code>
            .
          </li>
          <li>
            Confirm token/password is valid for target workspace and role.
          </li>
          <li>
            Confirm TLS cert chain and reverse-proxy upgrade headers are
            correct.
          </li>
          <li>Re-run Settings test and inspect diagnostics output.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Older references in archived docs">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Prioritize pages under{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              /docs/hosting/*
            </code>{" "}
            and{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">
              /docs/self-hosted
            </code>
            .
          </li>
          <li>
            If a markdown file mentions legacy provider/payment flow, treat it
            as historical unless linked from the docs sidebar.
          </li>
          <li>
            Use Public WSS + workspace-level OpenClaw settings as the current
            source of truth.
          </li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Escalation template for support/debug">
        <PublicDocsCodeBlock
          code={`Include all of the following:
- environment (local/staging/prod)
- exact failing URL
- exact timestamp
- workspace id
- user role
- screenshot/error text
- last successful action before failure`}
        />
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
