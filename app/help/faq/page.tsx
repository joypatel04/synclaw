"use client";

import { HelpCircle } from "lucide-react";
import { DocsCard, DocsFrame } from "@/app/help/_components/DocsFrame";

export default function FaqDocsPage() {
  return (
    <DocsFrame
      title="FAQ"
      description="Common questions about cloud vs self-hosted."
      icon={HelpCircle}
    >
      <div className="space-y-6">
        <DocsCard title="Is self-hosted intentionally difficult?">
          <p>
            No. It is developer-grade by design because it requires real infrastructure ownership. The process is
            documented, but it still includes operational complexity.
          </p>
        </DocsCard>

        <DocsCard title="Can users start on cloud and migrate later?">
          <p>
            Yes. Keep workspace and data model consistent so migration paths can be introduced with export/import or
            assisted migration support.
          </p>
        </DocsCard>

        <DocsCard title="What should non-technical users choose?">
          <p>Cloud. It is the default recommendation because it removes setup burden and accelerates time-to-value.</p>
        </DocsCard>

        <DocsCard title="Does self-hosted include support?">
          <p>
            Community-level support can be free, but installation assistance, migration work, and priority response
            should be paid support offerings.
          </p>
        </DocsCard>

        <DocsCard title="Can pricing change while billing is not enabled yet?">
          <p>
            Yes. Publish pricing intent now, keep billing UI labeled as coming soon, and activate checkout when your
            payment provider is fully configured.
          </p>
        </DocsCard>
      </div>
    </DocsFrame>
  );
}

