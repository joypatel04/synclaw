import { Wrench } from "lucide-react";
import {
  PublicDocsCallout,
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingSelfHostedMcpPage() {
  return (
    <PublicDocsShell
      title="Self-hosted: Configure OpenClaw + MCP"
      description="Connect gateway auth and MCP tooling to your workspace flow."
      icon={Wrench}
    >
      <PublicDocsCard title="1) OpenClaw gateway setup">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open <code className="rounded bg-bg-primary px-1 py-0.5">Settings -&gt; OpenClaw</code> in target workspace.</li>
          <li>Default to Public WSS (`wss://`) using explicit protocol and no trailing spaces.</li>
          <li>Set auth token with least required scopes.</li>
          <li>Add Synclaw origin to OpenClaw <code className="rounded bg-bg-primary px-1 py-0.5">allowedOrigins</code> and approve device.</li>
          <li>Save and re-open settings page to confirm persistence.</li>
        </ol>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Minimum values to verify"
            code={`Gateway URL: https://<gateway-host>
Token: <workspace-scoped-token>
Scopes: <required scopes for your runtime>
Environment: <dev|staging|prod workspace target>`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="Method decision (security-first)">
        <ul className="list-disc space-y-2 pl-5">
          <li>Public WSS is the recommended default for production.</li>
          <li>Private Connector is advanced and meant for private-network operators.</li>
          <li>Self-hosted Local is advanced and best only when app + OpenClaw are in same private environment.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="2) MCP server setup">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Deploy MCP server with required tool providers.</li>
          <li>Ensure network reachability between runtime and MCP endpoint over your expected network path.</li>
          <li>Validate auth between OpenClaw runtime and MCP server.</li>
          <li>Confirm tool manifest and schemas are loaded as expected.</li>
        </ol>
        <div className="mt-4 space-y-3">
          <PublicDocsCodeBlock
            title="MCP readiness checklist"
            code={`- Endpoint reachable from runtime host
- Auth secret/token valid
- Tool list discoverable
- Tool schema validation passes
- Timeout/retry policy defined`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="3) Verification run">
        <ul className="list-disc space-y-2 pl-5">
          <li>Create an agent and trigger one deterministic task.</li>
          <li>Confirm live activity events are emitted in app.</li>
          <li>Confirm tool call output is structured and reviewable.</li>
          <li>Check heartbeat and session update cadence.</li>
        </ul>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Suggested verification task"
            code={`Task: "Run one safe MCP tool call and summarize result"
Expected:
1) session starts
2) tool call logged
3) response persisted in activity/doc
4) no silent failure in UI`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="4) Failure patterns to check">
        <ul className="list-disc space-y-2 pl-5">
          <li>Token/scope mismatch in gateway auth.</li>
          <li>MCP endpoint unreachable or timed out.</li>
          <li>Unexpected tool schema payload causing run failures.</li>
          <li>Workspace-level config saved in wrong environment.</li>
        </ul>
        <div className="mt-4">
          <PublicDocsCallout title="Diagnostic order">
            Check gateway auth first, then MCP connectivity, then tool schema compatibility. This avoids chasing downstream
            symptoms.
          </PublicDocsCallout>
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="5) Production hardening">
        <ul className="list-disc space-y-2 pl-5">
          <li>Use separate tokens and endpoints for dev/staging/prod.</li>
          <li>Apply rate limiting and timeout caps on tool calls.</li>
          <li>Log request identifiers for tool execution traces.</li>
          <li>Document fallback behavior when MCP is degraded.</li>
        </ul>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
