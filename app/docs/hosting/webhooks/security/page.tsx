import {
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function WebhookSecurityDocsPage() {
  return (
    <PublicDocsShell
      title="Webhook Security"
      description="How to operate webhook endpoints safely in production."
      iconName="ShieldCheck"
    >
      <PublicDocsCard title="Baseline controls">
        <ul className="list-disc space-y-2 pl-5">
          <li>Use per-webhook secrets and rotate them regularly.</li>
          <li>
            Never store plain secrets after creation; only hashed secrets at
            rest.
          </li>
          <li>
            Use provider event IDs to protect against duplicate deliveries.
          </li>
          <li>Apply payload size limits and request rate limits.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Secret rotation runbook">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Rotate secret from Settings → Webhooks.</li>
          <li>Update sender integration with new value immediately.</li>
          <li>Send one test webhook and verify status `processed`.</li>
          <li>Audit payload history for unauthorized failures.</li>
        </ol>
      </PublicDocsCard>

      <PublicDocsCard title="Header checklist">
        <PublicDocsCodeBlock
          code={`Required:
  X-Synclaw-Webhook-Secret

Recommended:
  X-Provider-Event-Id
  Content-Type: application/json`}
        />
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
