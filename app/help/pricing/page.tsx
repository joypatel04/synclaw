"use client";

import { Coins } from "lucide-react";
import { DocsCard, DocsFrame } from "@/app/help/_components/DocsFrame";

export default function PricingDocsPage() {
  return (
    <DocsFrame
      title="Pricing Strategy"
      description="Cloud-first for convenience, OSS for control."
      icon={Coins}
    >
      <div className="space-y-6">
        <DocsCard title="Packaging model">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border-default bg-bg-tertiary p-4">
              <p className="text-sm font-semibold text-text-primary">Cloud Starter</p>
              <p className="mt-1 text-xs text-text-muted">
                Managed setup with essential limits and team workflow support.
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary p-4">
              <p className="text-sm font-semibold text-text-primary">Cloud Pro</p>
              <p className="mt-1 text-xs text-text-muted">
                Expanded limits, advanced controls, and deeper operational usage.
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-tertiary p-4">
              <p className="text-sm font-semibold text-text-primary">Self-hosted OSS</p>
              <p className="mt-1 text-xs text-text-muted">
                Free software path with self-managed infra and no managed support by default.
              </p>
            </div>
          </div>
        </DocsCard>

        <DocsCard title="Commercial logic">
          <ul className="list-disc space-y-2 pl-5">
            <li>Cloud sells convenience, speed, and operational reliability.</li>
            <li>Self-hosted gives control but keeps technical burden on the customer.</li>
            <li>Paid support tier monetizes complex self-hosted onboarding and maintenance help.</li>
          </ul>
        </DocsCard>

        <DocsCard title="Recommended go-live sequence">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Launch Cloud with trial and clear value proposition.</li>
            <li>Publish OSS setup docs for technical adopters.</li>
            <li>Add support/consulting plans once inbound setup requests appear.</li>
          </ol>
        </DocsCard>
      </div>
    </DocsFrame>
  );
}

