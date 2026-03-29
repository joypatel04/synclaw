"use client";

import { useState } from "react";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function ToolOutputSheet({
  toolCallId,
  toolName = "exec",
  command,
  output,
  rawDetails,
  children,
}: {
  toolCallId: string;
  toolName?: string;
  command?: string;
  output?: string;
  rawDetails?: unknown;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isError =
    typeof output === "string" &&
    (output.includes("Server Error") || output.includes("Request ID"));

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="cursor-pointer"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
      >
        {children}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-0">
          <SheetHeader className="border-b border-border-default">
            <SheetTitle className="text-lg">Tool Output</SheetTitle>
          </SheetHeader>

          <div className="p-4 space-y-6 overflow-y-auto">
            <div className="text-4xl font-semibold text-text-primary">
              {toolName}
            </div>

            <div className="space-y-2">
              <div className="text-text-muted font-semibold">Command:</div>
              <pre className="whitespace-pre-wrap break-words font-mono text-sm rounded-lg border border-border-default bg-bg-secondary p-3">
                {command || "(missing command)"}
              </pre>
            </div>

            <div className="space-y-2">
              {output ? (
                <>
                  <div className="text-text-muted font-semibold">Output:</div>
                  {isError ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm rounded-lg border border-border-default bg-bg-secondary p-3 text-status-blocked">
                      {output}
                    </pre>
                  ) : (
                    <div className="rounded-lg border border-border-default bg-bg-secondary p-3 text-sm text-text-primary">
                      <MarkdownContent content={output} />
                    </div>
                  )}
                </>
              ) : (
                <div className="italic text-text-dim">
                  No output — tool completed successfully.
                </div>
              )}
            </div>

            {rawDetails != null && (
              <details className="rounded-lg border border-border-default bg-bg-secondary p-3">
                <summary className="cursor-pointer text-sm text-text-muted">
                  Raw details
                </summary>
                <pre
                  className={cn(
                    "mt-3 text-xs overflow-x-auto",
                    isError ? "text-status-blocked" : "text-text-primary",
                  )}
                >
                  {JSON.stringify({ toolCallId, rawDetails }, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
