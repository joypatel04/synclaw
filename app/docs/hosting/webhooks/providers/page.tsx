import {
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function WebhookProviderRecipesPage() {
  return (
    <PublicDocsShell
      title="Webhook Provider Recipes"
      description="Practical examples for common event providers."
      iconName="PlugZap"
    >
      <PublicDocsCard title="GitHub Webhook (issues)">
        <PublicDocsCodeBlock
          code={`Payload URL:
https://<convex-site>.convex.site/api/v1/workspaces/webhooks/ingest?workspaceId=<workspaceId>&webhookId=<webhookId>

Secret:
<same value as X-Sutraha-Webhook-Secret>

Content type:
application/json

Events:
Issues, Issue comments (or desired subset)`}
        />
      </PublicDocsCard>

      <PublicDocsCard title="Zapier Webhooks by Zapier">
        <PublicDocsCodeBlock
          code={`Method: POST
URL: https://<convex-site>.convex.site/api/v1/workspaces/webhooks/ingest?workspaceId=<workspaceId>&webhookId=<webhookId>
Headers:
  X-Sutraha-Webhook-Secret: <secret>
  X-Provider-Event-Id: {{zap_meta_human_now}}
Body:
  {"event":{"type":"zap.trigger"},"payload":{...}}`}
        />
      </PublicDocsCard>

      <PublicDocsCard title="Generic server-to-server sender">
        <PublicDocsCodeBlock
          code={`POST /api/v1/workspaces/webhooks/ingest?workspaceId=<workspaceId>&webhookId=<webhookId>
X-Sutraha-Webhook-Secret: <secret>
X-Provider-Event-Id: <unique-event-id>
Content-Type: application/json

{
  "event": { "type": "source.event" },
  "payload": {
    "title": "Optional title",
    "message": "Optional message",
    "raw": { "any": "json" }
  }
}`}
        />
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
