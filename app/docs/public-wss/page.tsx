import { ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  PublicDocsCard,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";
import { brand } from "@/lib/brand";

export default function PublicWssDocsPage() {
  return (
    <PublicDocsShell
      title="Public WSS Setup"
      description={`Fastest way to start with ${brand.product.name} in OSS mode.`}
      iconName="Cloud"
    >
      <PublicDocsCard title="Who should pick Public WSS">
        <ul className="list-disc space-y-2 pl-5">
          <li>Users who already run OpenClaw and want to connect quickly.</li>
          <li>
            Teams validating product usage before advanced hosting complexity.
          </li>
          <li>
            Anyone launching OSS beta with minimum infrastructure overhead.
          </li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Quick start">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Create account and workspace.</li>
          <li>Complete onboarding setup flow.</li>
          <li>
            Connect OpenClaw settings per workspace using{" "}
            <code className="rounded bg-bg-primary px-1 py-0.5">wss://</code>.
          </li>
          <li>Create first agent and task.</li>
          <li>Verify live activity and review loop.</li>
        </ol>
      </PublicDocsCard>

      <PublicDocsCard title="Need production-level hosting docs?">
        <Link
          href="/docs/hosting/public-wss"
          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          Open detailed Public WSS hosting guide{" "}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
