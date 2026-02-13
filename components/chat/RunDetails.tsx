"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

type EventRow = Doc<"chatEvents">;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickRunId(payload: unknown): string | null {
  const obj = asRecord(payload);
  if (!obj) return null;
  const direct = obj.runId;
  if (typeof direct === "string" && direct.length > 0) return direct;
  for (const key of ["payload", "data", "message"]) {
    const nested = pickRunId(obj[key]);
    if (nested) return nested;
  }
  return null;
}

function pickTs(payload: unknown, fallback: number): number {
  const obj = asRecord(payload);
  if (!obj) return fallback;
  const candidates = [obj.ts, obj.timestamp, asRecord(obj.message)?.timestamp];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
  }
  const nested = asRecord(obj.payload);
  if (nested) return pickTs(nested, fallback);
  return fallback;
}

function stringifyShort(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    if (json.length <= 180) return json;
    return `${json.slice(0, 180)}…`;
  } catch {
    return String(value);
  }
}

type ToolArtifact = {
  id: string;
  kind: "tool_call" | "tool_result" | "exec" | "unknown";
  name: string;
  input?: unknown;
  output?: unknown;
  status?: string;
  ts: number;
  raw: unknown;
};

function extractToolArtifacts(events: EventRow[], runId: string): ToolArtifact[] {
  const artifacts: ToolArtifact[] = [];

  for (const e of events) {
    const payloadAny = e.payload as any;
    const p = payloadAny?.payload ?? payloadAny; // tolerate nesting
    const prun = pickRunId(p);
    if (prun !== runId) continue;

    const eventLabel =
      (typeof payloadAny?.event === "string" && payloadAny.event) ||
      (typeof payloadAny?.type === "string" && payloadAny.type) ||
      e.eventType;

    const ts = pickTs(p, e.receivedAt);

    // 1) Structured chat parts: payload.message.content[] with non-text parts
    const msg = asRecord(p?.message);
    const contentParts = Array.isArray(msg?.content) ? msg?.content : null;
    if (contentParts) {
      for (let i = 0; i < contentParts.length; i++) {
        const part = contentParts[i] as any;
        const partType = typeof part?.type === "string" ? part.type : "unknown";
        if (partType === "text") continue;
        const name =
          (typeof part?.name === "string" && part.name) ||
          (typeof part?.tool === "string" && part.tool) ||
          partType;
        artifacts.push({
          id: `${e._id}:${i}`,
          kind:
            partType.includes("result") || partType.includes("output")
              ? "tool_result"
              : partType.includes("call") || partType.includes("tool")
                ? "tool_call"
                : "unknown",
          name,
          input: part?.input ?? part?.args ?? part?.arguments,
          output: part?.output ?? part?.result,
          status: typeof p?.state === "string" ? p.state : undefined,
          ts,
          raw: part,
        });
      }
    }

    // 2) Agent stream tool/exec-like events: payload.stream + payload.data
    const stream = typeof p?.stream === "string" ? p.stream : null;
    if (stream && (stream === "tool" || stream === "exec" || stream === "call")) {
      const data = p?.data;
      const name =
        (typeof data?.name === "string" && data.name) ||
        (typeof data?.tool === "string" && data.tool) ||
        (typeof p?.tool === "string" && p.tool) ||
        stream;
      artifacts.push({
        id: e._id,
        kind: stream === "exec" ? "exec" : "tool_call",
        name,
        input: data?.input ?? data?.args ?? data?.arguments ?? data,
        output: data?.output ?? data?.result,
        status: typeof data?.status === "string" ? data.status : undefined,
        ts,
        raw: p,
      });
    }

    // 3) Generic exec/tool fields anywhere
    const maybeToolName =
      (typeof p?.toolName === "string" && p.toolName) ||
      (typeof p?.tool === "string" && p.tool) ||
      (typeof p?.name === "string" && p.name) ||
      null;
    if (maybeToolName && (eventLabel.includes("exec") || eventLabel.includes("tool"))) {
      artifacts.push({
        id: e._id,
        kind: eventLabel.includes("exec") ? "exec" : "tool_call",
        name: maybeToolName,
        input: p?.args ?? p?.input,
        output: p?.result ?? p?.output,
        status: typeof p?.status === "string" ? p.status : undefined,
        ts,
        raw: p,
      });
    }
  }

  return artifacts
    .filter((a, idx, arr) => arr.findIndex((b) => b.id === a.id) === idx)
    .sort((a, b) => a.ts - b.ts);
}

export function RunDetails({
  runId,
  eventsForSession,
  className,
}: {
  runId: string;
  eventsForSession: EventRow[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const runEvents = useMemo(() => {
    return eventsForSession
      .filter((e) => {
        const payloadAny = e.payload as any;
        const p = payloadAny?.payload ?? payloadAny;
        return pickRunId(p) === runId;
      })
      .slice()
      .sort((a, b) => a.receivedAt - b.receivedAt);
  }, [eventsForSession, runId]);

  const tools = useMemo(
    () => extractToolArtifacts(runEvents, runId),
    [runEvents, runId],
  );

  if (runEvents.length === 0) return null;

  return (
    <div className={cn("mt-2", className)}>
      <button
        type="button"
        className="text-[10px] text-text-dim hover:text-text-primary underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide run details" : "Show run details"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border-default bg-bg-secondary p-2">
          <div className="mb-2 text-[10px] text-text-dim font-mono break-all">
            runId: {runId}
          </div>

          <Tabs defaultValue="timeline" className="gap-2">
            <TabsList variant="line" className="h-8">
              <TabsTrigger value="timeline" className="text-xs">
                Timeline ({runEvents.length})
              </TabsTrigger>
              <TabsTrigger value="tools" className="text-xs">
                Tools ({tools.length})
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs">
                Raw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <div className="space-y-1">
                {runEvents.map((e) => {
                  const payloadAny = e.payload as any;
                  const p = payloadAny?.payload ?? payloadAny;
                  const eventLabel =
                    (typeof payloadAny?.event === "string" && payloadAny.event) ||
                    (typeof payloadAny?.type === "string" && payloadAny.type) ||
                    e.eventType;
                  const stream =
                    typeof p?.stream === "string" ? `:${p.stream}` : "";
                  const state = typeof p?.state === "string" ? ` ${p.state}` : "";
                  return (
                    <div key={e._id} className="text-[10px] text-text-primary">
                      <span className="text-text-dim">{eventLabel}{stream}{state}</span>
                      <span className="text-text-dim"> · </span>
                      <span className="font-mono break-all">{e.eventId}</span>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="tools">
              {tools.length === 0 ? (
                <div className="text-[10px] text-text-dim">
                  No tool artifacts detected for this run yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {tools.map((t) => (
                    <details
                      key={t.id}
                      className="rounded-lg border border-border-default bg-bg-tertiary p-2"
                    >
                      <summary className="cursor-pointer select-none text-[11px] text-text-primary">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-text-dim"> · {t.kind}</span>
                        {t.status ? (
                          <span className="text-text-dim"> · {t.status}</span>
                        ) : null}
                      </summary>
                      <div className="mt-2 space-y-2">
                        {t.input !== undefined && (
                          <div>
                            <div className="text-[10px] text-text-dim mb-1">
                              Input
                            </div>
                            <pre className="text-[10px] overflow-x-auto rounded-md bg-bg-secondary p-2">
                              {JSON.stringify(t.input, null, 2)}
                            </pre>
                          </div>
                        )}
                        {t.output !== undefined && (
                          <div>
                            <div className="text-[10px] text-text-dim mb-1">
                              Output
                            </div>
                            {typeof t.output === "string" ? (
                              <div className="text-[11px] text-text-primary">
                                <MarkdownContent content={t.output} />
                              </div>
                            ) : (
                              <pre className="text-[10px] overflow-x-auto rounded-md bg-bg-secondary p-2">
                                {JSON.stringify(t.output, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                        {t.input === undefined && t.output === undefined && (
                          <div className="text-[10px] text-text-dim">
                            {stringifyShort(t.raw)}
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="raw">
              <pre className="text-[10px] overflow-x-auto rounded-md bg-bg-tertiary p-2">
                {JSON.stringify(runEvents.map((e) => e.payload), null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

