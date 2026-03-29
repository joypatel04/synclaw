import { MarkdownContent } from "@/components/shared/MarkdownContent";

export function MarkdownDocCard({ content }: { content: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
      <MarkdownContent
        content={content}
        className="text-sm leading-relaxed text-text-secondary"
      />
    </div>
  );
}
