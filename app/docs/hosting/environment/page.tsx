import { Settings2 } from "lucide-react";
import {
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingEnvironmentReferencePage() {
  return (
    <PublicDocsShell
      title="Environment Variable Reference"
      description="Detailed meaning and usage for deployment variables."
      icon={Settings2}
    >
      <PublicDocsCard title="Core Convex variables">
        <ul className="list-disc space-y-2 pl-5">
          <li><code className="rounded bg-bg-primary px-1 py-0.5">NEXT_PUBLIC_CONVEX_URL</code>: client URL used by frontend to connect to Convex.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">NEXT_PUBLIC_CONVEX_SITE_URL</code>: Convex site URL used by auth callback flow.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">CONVEX_DEPLOYMENT</code>: deployment key mapping app to correct Convex environment.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Auth variables">
        <ul className="list-disc space-y-2 pl-5">
          <li><code className="rounded bg-bg-primary px-1 py-0.5">AUTH_GITHUB_ID</code>: GitHub OAuth client id.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">AUTH_GITHUB_SECRET</code>: GitHub OAuth client secret.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="App branding and behavior">
        <ul className="list-disc space-y-2 pl-5">
          <li><code className="rounded bg-bg-primary px-1 py-0.5">NEXT_PUBLIC_APP_NAME</code>: fallback display name across UI.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">NEXT_PUBLIC_APP_URL</code>: public base URL for app metadata and links.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">NEXT_PUBLIC_BRAND_CONFIG_JSON</code>: optional runtime override for branding copy.</li>
          <li><code className="rounded bg-bg-primary px-1 py-0.5">NEXT_PUBLIC_BILLING_ENABLED</code>: toggles billing UI visibility.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="OpenClaw security variable (Convex env)">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="rounded bg-bg-primary px-1 py-0.5">OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX</code>: hex key used for encrypting
            gateway tokens at rest.
          </li>
        </ul>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Generate and set encryption key"
            code={`openssl rand -hex 32
bunx convex env set OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX <generated-hex-value>`}
          />
        </div>
      </PublicDocsCard>

      <PublicDocsCard title="Razorpay variables (when billing is enabled)">
        <ul className="list-disc space-y-2 pl-5">
          <li><code className="rounded bg-bg-primary px-1 py-0.5">RAZORPAY_KEY_ID</code>, <code className="rounded bg-bg-primary px-1 py-0.5">RAZORPAY_KEY_SECRET</code>, <code className="rounded bg-bg-primary px-1 py-0.5">RAZORPAY_WEBHOOK_SECRET</code></li>
          <li>Plan IDs for Starter/Pro, monthly/yearly, INR/USD variants.</li>
        </ul>
        <div className="mt-4">
          <PublicDocsCodeBlock
            title="Billing env template"
            code={`RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_STARTER_MONTHLY_INR=plan_...
RAZORPAY_PLAN_STARTER_YEARLY_INR=plan_...
RAZORPAY_PLAN_PRO_MONTHLY_INR=plan_...
RAZORPAY_PLAN_PRO_YEARLY_INR=plan_...
RAZORPAY_PLAN_STARTER_MONTHLY_USD=plan_...
RAZORPAY_PLAN_STARTER_YEARLY_USD=plan_...
RAZORPAY_PLAN_PRO_MONTHLY_USD=plan_...
RAZORPAY_PLAN_PRO_YEARLY_USD=plan_...`}
          />
        </div>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}

