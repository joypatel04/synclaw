"use client";

import Link from "next/link";
import { Cloud, ExternalLink } from "lucide-react";
import { brand } from "@/lib/brand";
import { DocsCard, DocsFrame } from "@/app/help/_components/DocsFrame";

export default function CloudDocsPage() {
  return (
    <DocsFrame
      title="Cloud Setup"
      description="Fastest onboarding flow for real users."
      icon={Cloud}
    >
      <div className="space-y-6">
        <DocsCard title="Who should use Cloud">
          <ul className="list-disc space-y-2 pl-5">
            <li>Solopreneurs and teams that want fast activation and lower setup friction.</li>
            <li>Operators who prefer managed infrastructure and support.</li>
            <li>Anyone validating product-market fit before technical customization.</li>
          </ul>
        </DocsCard>

        <DocsCard title="Cloud onboarding checklist">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Create account and workspace in {brand.product.name}.</li>
            <li>Complete guided setup in chat and connect your OpenClaw settings.</li>
            <li>Create your first agent from recipe and verify activity feed updates.</li>
            <li>Invite team members and assign workspace roles.</li>
            <li>Activate billing when provider integration is enabled.</li>
          </ol>
        </DocsCard>

        <DocsCard title="Operational notes">
          <ul className="list-disc space-y-2 pl-5">
            <li>Billing UI can show Coming Soon while payment provider setup is in progress.</li>
            <li>Core workflow stays usable for onboarding and validation during this phase.</li>
            <li>Support add-ons can be introduced as a separate paid tier.</li>
          </ul>
        </DocsCard>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">Next</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/help/pricing"
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover"
            >
              Review pricing <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/settings/billing"
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover"
            >
              Billing settings <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </DocsFrame>
  );
}

