import { AlertTriangle } from "lucide-react";
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
      icon={AlertTriangle}
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
https://<convex-site>.convex.site/api/auth/signin/github

Check:
1) OAuth app callback URL
2) .env.local AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
3) runtime restart after env edits`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title='Convex errors like "No matching routes found"'>
        <ul className="list-disc space-y-2 pl-5">
          <li>Run <code className="rounded bg-bg-primary px-1 py-0.5">bunx convex dev</code> and confirm functions are ready.</li>
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
          <li>Confirm failure appears in activity logs with actionable details.</li>
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

      <PublicDocsCard title="Billing not active yet">
        <ul className="list-disc space-y-2 pl-5">
          <li>Keep billing UI in Coming Soon state until provider webhooks are verified.</li>
          <li>Continue onboarding and trial validation in parallel.</li>
          <li>Enable checkout only after end-to-end payment test passes.</li>
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
