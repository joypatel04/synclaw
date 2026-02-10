"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown (including GFM: tables, strikethrough, etc.) for task descriptions,
 * comments, chat messages, and broadcasts. Plain text is still rendered correctly.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        // whitespace-pre-line: preserve line breaks but collapse extra spaces,
        // so agent output keeps manual line breaks without blowing up spacing.
        "markdown-content text-inherit whitespace-pre-line [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_a]:text-accent-orange [&_a]:underline [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_code]:text-xs [&_code]:bg-bg-tertiary [&_code]:px-1 [&_code]:rounded [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_th]:text-left [&_th]:border-b [&_th]:border-border-default [&_td]:border-b [&_td]:border-border-default [&_th_td]:py-1.5 [&_th_td]:pr-2",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
