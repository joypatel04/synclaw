import { Coins } from "lucide-react";
import {
  PublicDocsCard,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function PublicPricingDocsPage() {
  return (
    <PublicDocsShell
      title="Packaging Model"
      description="How OSS core and hosted/commercial offerings are separated."
      icon={Coins}
    >
      <PublicDocsCard title="Current model">
        <ul className="list-disc space-y-2 pl-5">
          <li>OSS core focuses on Public WSS + BYO OpenClaw workflows.</li>
          <li>
            Self-hosted remains available for teams needing infra ownership.
          </li>
          <li>Internal/extended operations are separate from OSS launch docs.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="Why this split exists">
        <ul className="list-disc space-y-2 pl-5">
          <li>OSS docs stay clean and actionable for builders shipping now.</li>
          <li>
            Extended features can evolve without destabilizing core setup
            docs.
          </li>
          <li>Teams can start in OSS mode and expand operations later.</li>
        </ul>
      </PublicDocsCard>
    </PublicDocsShell>
  );
}
