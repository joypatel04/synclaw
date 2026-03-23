import { Coins } from "lucide-react";
import { DocsFrame } from "@/app/help/_components/DocsFrame";
import { MarkdownDocCard } from "@/app/help/_components/MarkdownDocCard";
import { HELP_DOCS, readHelpDoc } from "@/lib/helpDocs";

export default async function PricingDocsPage() {
  const guide = await readHelpDoc("pricing");

  return (
    <DocsFrame
      title={HELP_DOCS.pricing.title}
      description={HELP_DOCS.pricing.description}
      icon={Coins}
    >
      <MarkdownDocCard content={guide} />
    </DocsFrame>
  );
}
