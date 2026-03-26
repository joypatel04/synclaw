import { Cloud } from "lucide-react";
import Link from "next/link";
import { DocsCard, DocsFrame } from "@/app/help/_components/DocsFrame";
import { MarkdownDocCard } from "@/app/help/_components/MarkdownDocCard";
import { HELP_DOCS, readHelpDoc } from "@/lib/helpDocs";

export default async function PublicWssHelpPage() {
  const guide = await readHelpDoc("publicWss");

  return (
    <DocsFrame
      title={HELP_DOCS.publicWss.title}
      description={HELP_DOCS.publicWss.description}
      icon={Cloud}
    >
      <div className="space-y-6">
        <MarkdownDocCard content={guide} />

        <DocsCard title="Continue">
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href="/onboarding"
              className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Open onboarding
            </Link>
            <Link
              href="/agents/new"
              className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Create & Configure Agent
            </Link>
            <Link
              href="/chat"
              className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Open chat
            </Link>
          </div>
        </DocsCard>
      </div>
    </DocsFrame>
  );
}
