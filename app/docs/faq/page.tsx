import {
  PublicDocsCard,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function PublicFaqDocsPage() {
  return (
    <PublicDocsShell
      title="FAQ"
      description="Common Public WSS vs self-hosted questions."
      iconName="HelpCircle"
    >
      <PublicDocsCard title="Is self-hosted intentionally difficult?">
        <p>
          No. It is documented clearly, but infra ownership naturally adds
          operational complexity.
        </p>
      </PublicDocsCard>

      <PublicDocsCard title="Which option is right for non-technical users?">
        <p>
          Public WSS is the recommended path for non-technical users and teams
          that want fast activation.
        </p>
      </PublicDocsCard>

      <PublicDocsCard title="Can users move from Public WSS to Self-hosted later?">
        <p>
          Yes. Keep workspace model and data structures consistent to support
          migration paths.
        </p>
      </PublicDocsCard>

      <PublicDocsCard title="What is the default launch path now?">
        <p>
          Public WSS + BYO OpenClaw is the default path. Users configure
          OpenClaw per workspace from Settings, then create agents and run
          tasks.
        </p>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
