import {
  BookOpen,
  CircleHelp,
  Cloud,
  Coins,
  HardDrive,
  LifeBuoy,
} from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { HELP_DOCS } from "@/lib/helpDocs";

const icons = {
  gettingStarted: BookOpen,
  publicWss: Cloud,
  selfHosted: HardDrive,
  pricing: Coins,
  faq: CircleHelp,
} as const;

export default function HelpPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-3 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-hover glow-orange">
            <LifeBuoy className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary sm:text-xl">
              Resources
            </h1>
            <p className="mt-1 text-xs text-text-muted">
              Clean documentation aligned with the current Synclaw codebase.
            </p>
          </div>
        </div>

        <section className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Start here
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
            <li>Run onboarding and connect OpenClaw.</li>
            <li>Create an agent with one-click setup.</li>
            <li>Open chat and start execution.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/onboarding">Open onboarding</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/agents/new">Create & Configure Agent</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/chat">Open chat</Link>
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Documentation
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Markdown-backed docs for Public WSS and self-hosted operation.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(HELP_DOCS) as Array<keyof typeof HELP_DOCS>).map(
              (slug) => {
                const doc = HELP_DOCS[slug];
                const Icon = icons[slug];
                return (
                  <Link
                    key={doc.href}
                    href={doc.href}
                    className="rounded-xl border border-border-default bg-bg-tertiary p-4 transition hover:border-border-hover hover:bg-bg-hover"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary">
                        <Icon className="h-4 w-4 text-text-secondary" />
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
                  </Link>
                );
              },
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
