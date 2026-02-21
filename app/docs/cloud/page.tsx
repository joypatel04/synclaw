import Link from "next/link";
import { ArrowRight, Cloud } from "lucide-react";
import { brand } from "@/lib/brand";
import { PublicDocsCard, PublicDocsShell } from "@/app/docs/_components/PublicDocsShell";

export default function PublicCloudDocsPage() {
  return (
    <PublicDocsShell
      title="Cloud Setup"
      description={`Fastest way to start with ${brand.product.name}.`}
      icon={Cloud}
    >
      <PublicDocsCard title="Who should pick Cloud">
        <ul className="list-disc space-y-2 pl-5">
          <li>Users who want immediate onboarding without infra setup.</li>
          <li>Teams focused on outcomes over platform maintenance.</li>
          <li>Anyone validating usage before deep customization.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Quick start">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Create account and workspace.</li>
          <li>Complete onboarding setup flow.</li>
          <li>Connect OpenClaw settings per workspace.</li>
          <li>Create first agent and task.</li>
          <li>Verify live activity and review loop.</li>
        </ol>
      </PublicDocsCard>

      <PublicDocsCard title="Need production-level hosting docs?">
        <Link
          href="/docs/hosting/cloud"
          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          Open detailed cloud hosting guide <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
