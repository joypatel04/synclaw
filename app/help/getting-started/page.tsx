import { ArrowRight, BookOpen, Cloud, HardDrive } from "lucide-react";
import Link from "next/link";
import { DocsCard, DocsFrame } from "@/app/help/_components/DocsFrame";
import { MarkdownDocCard } from "@/app/help/_components/MarkdownDocCard";
import { HELP_DOCS, readHelpDoc } from "@/lib/helpDocs";

export default async function GettingStartedPage() {
  const guide = await readHelpDoc("gettingStarted");

  return (
    <DocsFrame
      title={HELP_DOCS.gettingStarted.title}
      description={HELP_DOCS.gettingStarted.description}
      icon={BookOpen}
    >
      <div className="space-y-6">
        <MarkdownDocCard content={guide} />

        <DocsCard title="Choose your deployment path">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                href: HELP_DOCS.publicWss.href,
                title: HELP_DOCS.publicWss.title,
                description: HELP_DOCS.publicWss.description,
                icon: Cloud,
              },
              {
                href: HELP_DOCS.selfHosted.href,
                title: HELP_DOCS.selfHosted.title,
                description: HELP_DOCS.selfHosted.description,
                icon: HardDrive,
              },
            ].map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-border-hover hover:bg-bg-hover"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                    <doc.icon className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {doc.title}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {doc.description}
                    </p>
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </DocsCard>
      </div>
    </DocsFrame>
  );
}
