import Link from "next/link";
import { ArrowRight, Webhook } from "lucide-react";
import {
  PublicDocsCallout,
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingWebhooksPage() {
  return (
    <PublicDocsShell
      title="Webhook Automation"
      description="Ingest external events into a workspace and convert them into tasks, docs, and activity."
      icon={Webhook}
    >
      <PublicDocsCard title="Endpoint contract (v1)">
        <PublicDocsCodeBlock
          code={`POST /api/v1/workspaces/webhooks/ingest?workspaceId=<workspaceId>&webhookId=<webhookId>
Headers:
  X-Sutraha-Webhook-Secret: <secret>  (required)
  X-Provider-Event-Id: <provider event id> (optional, for idempotency)
  Content-Type: application/json

Success:
  202 Accepted

Errors:
  401/403 secret invalid
  404 webhook not found
  413 payload too large (>262144 bytes)
  429 rate limit exceeded`}
        />
      </PublicDocsCard>

      <PublicDocsCard title="Action templates">
        <ul className="list-disc space-y-2 pl-5">
          <li><code className="rounded bg-bg-primary px-1 py-0.5">create_task</code>: create task from payload mapping.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">create_document</code>: create note document from payload.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">log_activity</code>: append webhook event in activity feed.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">task_and_nudge_main</code>: create task and notify main agent.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Quick test with curl">
        <PublicDocsCodeBlock
          code={`curl -X POST "https://<convex-site>.convex.site/api/v1/workspaces/webhooks/ingest?workspaceId=<workspaceId>&webhookId=<webhookId>" \\
  -H "Content-Type: application/json" \\
  -H "X-Sutraha-Webhook-Secret: <secret>" \\
  -H "X-Provider-Event-Id: evt-001" \\
  -d '{"event":{"type":"demo.webhook"},"payload":{"message":"hello"}}'`}
        />
      </PublicDocsCard>

      <PublicDocsCard title="Next guides">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/docs/hosting/webhooks/security"
            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover"
          >
            Security guide <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/docs/hosting/webhooks/providers"
            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover"
          >
            Provider recipes <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4">
          <PublicDocsCallout title="Recommended">
            Use provider event IDs whenever available so duplicate deliveries do not create duplicate tasks/documents.
          </PublicDocsCallout>
        </div>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
