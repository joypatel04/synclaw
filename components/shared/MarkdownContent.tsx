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
        // Keep markdown spacing tight, but make "docs-like" rendering for headings,
        // code blocks, and tables so messages read well.
        // Responsive safety:
        // - `break-words` prevents long tokens from blowing out the bubble
        // - tables become scrollable by switching them to block-level
        "markdown-content min-w-0 max-w-full overflow-x-hidden text-inherit break-words [overflow-wrap:anywhere]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...props }) => (
            <h1
              {...props}
              className="text-xl font-bold text-text-primary mt-2 mb-2 first:mt-0"
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              {...props}
              className="text-lg font-semibold text-text-primary mt-3 mb-2 first:mt-0"
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              {...props}
              className="text-base font-semibold text-text-primary mt-3 mb-1.5 first:mt-0"
            >
              {children}
            </h3>
          ),
          p: ({ children, ...props }) => (
            <p
              {...props}
              className="my-1 first:mt-0 last:mb-0 [overflow-wrap:anywhere]"
            >
              {children}
            </p>
          ),
          a: ({ children, ...props }) => (
            <a
              {...props}
              className="text-accent-orange underline underline-offset-2"
              target={props.href?.startsWith("http") ? "_blank" : undefined}
              rel={
                props.href?.startsWith("http")
                  ? "noreferrer noopener"
                  : undefined
              }
            >
              {children}
            </a>
          ),
          ul: ({ children, ...props }) => (
            <ul {...props} className="my-1 list-disc pl-5">
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol {...props} className="my-1 list-decimal pl-5">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li {...props} className="my-0.5">
              {children}
            </li>
          ),
          hr: (props) => (
            <hr {...props} className="my-3 border-border-default" />
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              {...props}
              className="my-2 border-l-2 border-border-default pl-3 text-text-dim"
            >
              {children}
            </blockquote>
          ),
          strong: ({ children, ...props }) => (
            <strong {...props} className="font-semibold text-text-primary">
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em {...props} className="italic">
              {children}
            </em>
          ),
          del: ({ children, ...props }) => (
            <del {...props} className="line-through text-text-dim">
              {children}
            </del>
          ),
          code: ({ className, children, ...props }: any) => {
            const inline = !!props.inline;
            if (inline) {
              return (
                <code
                  {...props}
                  className={cn(
                    // Inline code should read like a "chip" (similar to the tool command pill),
                    // and remain visible on both agent and user bubbles.
                    "font-mono text-[12px] rounded-md border border-border-default bg-bg-secondary/70 px-1.5 py-0.5 text-text-primary",
                    "break-all",
                    className,
                  )}
                >
                  {children}
                </code>
              );
            }

            // Fenced/indented code blocks: <pre> provides the panel styling.
            return (
              <code
                {...props}
                className={cn(
                  "font-mono text-[12px] leading-relaxed",
                  className,
                )}
              >
                {children}
              </code>
            );
          },
          pre: ({ children, ...props }) => (
            <pre
              {...props}
              className="my-2 overflow-x-auto rounded-xl border border-border-default bg-bg-tertiary p-3 text-[12px] leading-relaxed"
            >
              {children}
            </pre>
          ),
          table: ({ children, ...props }) => (
            <div className="my-2 max-w-full overflow-x-auto">
              <div className="min-w-fit rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
                <table
                  {...props}
                  className="w-max min-w-full border-collapse text-[12px]"
                >
                  {children}
                </table>
              </div>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead {...props} className="bg-bg-tertiary">
              {children}
            </thead>
          ),
          th: ({ children, ...props }) => (
            <th
              {...props}
              className="border-b border-border-default px-2 py-1.5 text-left font-semibold text-text-primary whitespace-nowrap"
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              {...props}
              className="border-b border-border-default px-2 py-1.5 align-top text-text-primary whitespace-normal break-words"
            >
              {children}
            </td>
          ),
          img: (props) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...props}
              className={cn(
                "my-2 max-w-full rounded-lg border border-border-default",
                (props as any).className,
              )}
              alt={props.alt ?? ""}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
