import { HelpCircle } from "lucide-react";
import { PublicDocsCard, PublicDocsShell } from "@/app/docs/_components/PublicDocsShell";

export default function PublicFaqDocsPage() {
  return (
    <PublicDocsShell
      title="FAQ"
      description="Common cloud vs self-hosted questions."
      icon={HelpCircle}
    >
      <PublicDocsCard title="Is self-hosted intentionally difficult?">
        <p>
          No. It is documented clearly, but infra ownership naturally adds operational complexity.
        </p>
      </PublicDocsCard>

      <PublicDocsCard title="Which option is right for non-technical users?">
        <p>Cloud is the recommended path for non-technical users and teams that want fast activation.</p>
      </PublicDocsCard>

      <PublicDocsCard title="Can users move from Cloud to Self-hosted later?">
        <p>Yes. Keep workspace model and data structures consistent to support migration paths.</p>
      </PublicDocsCard>

      <PublicDocsCard title="Can we launch before billing is fully enabled?">
        <p>Yes. Launch onboarding and usage first, and enable billing when provider setup is complete.</p>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}

