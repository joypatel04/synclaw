import { HardDrive } from "lucide-react";
import Link from "next/link";
import { DocsCard, DocsFrame } from "@/app/help/_components/DocsFrame";
import { MarkdownDocCard } from "@/app/help/_components/MarkdownDocCard";
import { HELP_DOCS, readHelpDoc } from "@/lib/helpDocs";

export default async function SelfHostedDocsPage() {
  const guide = await readHelpDoc("selfHosted");

  return (
    <DocsFrame
      title={HELP_DOCS.selfHosted.title}
      description={HELP_DOCS.selfHosted.description}
      icon={HardDrive}
    >
      <div className="space-y-6">
        <MarkdownDocCard content={guide} />

        <DocsCard title="Related references">
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href="/docs/hosting/environment"
              className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Environment reference
            </Link>
            <Link
              href="/docs/hosting/self-hosted/files-bridge"
              className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Files bridge setup
            </Link>
            <Link
              href="/docs/hosting/troubleshooting"
              className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Troubleshooting
            </Link>
          </div>
        </DocsCard>
      </div>
    </DocsFrame>
  );
}
