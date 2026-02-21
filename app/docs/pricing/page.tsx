import { Coins } from "lucide-react";
import { PublicDocsCard, PublicDocsShell } from "@/app/docs/_components/PublicDocsShell";

export default function PublicPricingDocsPage() {
  return (
    <PublicDocsShell
      title="Pricing Strategy"
      description="Cloud-first monetization with self-hosted OSS option."
      icon={Coins}
    >
      <PublicDocsCard title="Plan structure">
        <ul className="list-disc space-y-2 pl-5">
          <li>Cloud Starter: managed setup and core usage.</li>
          <li>Cloud Pro: expanded limits and advanced controls.</li>
          <li>Self-hosted OSS: free software path for technical teams.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Commercial model">
        <ul className="list-disc space-y-2 pl-5">
          <li>Cloud sells convenience and reliability.</li>
          <li>Self-hosted sells control and customization.</li>
          <li>Support plans monetize implementation and priority assistance.</li>
        </ul>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}

