import { HelpCircle } from "lucide-react";
import { DocsFrame } from "@/app/help/_components/DocsFrame";
import { MarkdownDocCard } from "@/app/help/_components/MarkdownDocCard";
import { HELP_DOCS, readHelpDoc } from "@/lib/helpDocs";

export default async function FaqDocsPage() {
  const guide = await readHelpDoc("faq");

  return (
    <DocsFrame
      title={HELP_DOCS.faq.title}
      description={HELP_DOCS.faq.description}
      icon={HelpCircle}
    >
      <MarkdownDocCard content={guide} />
    </DocsFrame>
  );
}
