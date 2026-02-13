"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, RefreshCw } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  extractDisplayMessagesFromHistory,
  OpenClawBrowserGatewayClient,
} from "@/lib/openclaw-gateway-client";

type OpenClawSessionRow = {
  key: string;
  updatedAt?: number;
  age?: number;
};

type SessionDetails = {
  snippet?: string;
  role?: string;
  at?: number;
  loading: boolean;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stripRunSuffix(sessionKey: string): string {
  // OpenClaw can emit per-run session keys like:
  // - agent:main:main:run:<runId>
  // - agent:vision:cron:<cronId>:run:<runId>
  // For the "Other Sessions" list we want one row per base session, so we
  // collapse `:run:` children into their parent session.
  const idx = sessionKey.indexOf(":run:");
  return idx === -1 ? sessionKey : sessionKey.slice(0, idx);
}

function pickRecentSessionsFromHealth(payload: unknown): OpenClawSessionRow[] {
  const p = asRecord(payload);
  if (!p) return [];

  const out: OpenClawSessionRow[] = [];

  const sessions = asRecord(p.sessions);
  const recent = sessions && Array.isArray(sessions.recent) ? sessions.recent : [];
  for (const item of recent) {
    const r = asRecord(item);
    const key = r && typeof r.key === "string" ? r.key : null;
    if (!key) continue;
    out.push({
      key: stripRunSuffix(key),
      updatedAt: typeof r?.updatedAt === "number" ? r?.updatedAt : undefined,
      age: typeof r?.age === "number" ? r?.age : undefined,
    });
  }

  const agents = Array.isArray(p.agents) ? p.agents : [];
  for (const a of agents) {
    const ar = asRecord(a);
    const aSessions = ar ? asRecord(ar.sessions) : null;
    const aRecent =
      aSessions && Array.isArray(aSessions.recent) ? aSessions.recent : [];
    for (const item of aRecent) {
      const r = asRecord(item);
      const key = r && typeof r.key === "string" ? r.key : null;
      if (!key) continue;
      out.push({
        key: stripRunSuffix(key),
        updatedAt: typeof r?.updatedAt === "number" ? r?.updatedAt : undefined,
        age: typeof r?.age === "number" ? r?.age : undefined,
      });
    }
  }

  // De-dupe by key, keep the newest updatedAt when available.
  const byKey = new Map<string, OpenClawSessionRow>();
  for (const row of out) {
    const existing = byKey.get(row.key);
    if (!existing) {
      byKey.set(row.key, row);
      continue;
    }
    const eU = existing.updatedAt ?? 0;
    const rU = row.updatedAt ?? 0;
    if (rU > eU) byKey.set(row.key, row);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const au = a.updatedAt ?? 0;
    const bu = b.updatedAt ?? 0;
    if (au !== bu) return bu - au;
    return a.key.localeCompare(b.key);
  });
}

function prettySessionLabel(sessionKey: string): string {
  // Common shapes:
  // - agent:main:main
  // - agent:vision:cron:...
  // - agent:main:main:run:...
  const parts = sessionKey.split(":");
  if (parts[0] === "agent" && parts.length >= 3) {
    const agentId = parts[1];
    const channel = parts[2];
    return channel === "main" ? agentId : `${agentId} (${channel})`;
  }
  return sessionKey;
}

function sessionKind(sessionKey: string): "run" | "cron" | "main" | "other" {
  if (sessionKey.includes(":run:")) return "run";
  if (sessionKey.includes(":cron:")) return "cron";
  if (sessionKey.startsWith("agent:") && sessionKey.endsWith(":main"))
    return "main";
  if (sessionKey.startsWith("agent:") && sessionKey.includes(":main"))
    return "main";
  return "other";
}

function formatAgeMinutes(ageSeconds: number): string {
  const mins = Math.max(0, Math.round(ageSeconds / 60));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return `${hours}h`;
}

export function OpenClawSessionsList({
  agents,
}: {
  agents: Array<Pick<Doc<"agents">, "sessionKey"> & {
    name: string;
    emoji: string;
  }>;
}) {
  const [sessions, setSessions] = useState<OpenClawSessionRow[]>([]);
  const [detailsByKey, setDetailsByKey] = useState<Record<string, SessionDetails>>({});
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<OpenClawBrowserGatewayClient | null>(null);

  const includeCron =
    process.env.NEXT_PUBLIC_OPENCLAW_INCLUDE_CRON === "true";

  const knownAgentSessionKeys = useMemo(() => {
    return new Set(agents.map((a) => a.sessionKey));
  }, [agents]);

  const otherSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (knownAgentSessionKeys.has(s.key)) return false;
      if (!includeCron && s.key.includes(":cron:")) return false;
      return true;
    });
  }, [sessions, knownAgentSessionKeys, includeCron]);

  const agentByKeyPrefix = useMemo(() => {
    // Map `agent:<id>:` prefixes to emoji/name so we can label cron/run sessions nicely.
    const map = new Map<string, { name: string; emoji: string }>();
    for (const a of agents) {
      if (typeof a.sessionKey !== "string") continue;
      const parts = a.sessionKey.split(":");
      if (parts[0] !== "agent" || parts.length < 2) continue;
      const prefix = `agent:${parts[1]}:`;
      map.set(prefix, { name: a.name, emoji: a.emoji });
    }
    return map;
  }, [agents]);

  const lookupAgent = (sessionKey: string) => {
    for (const [prefix, meta] of agentByKeyPrefix.entries()) {
      if (sessionKey.startsWith(prefix)) return meta;
    }
    return null;
  };

  const connect = async () => {
    setStatus("connecting");
    setError(null);
    setSessions([]);
    setDetailsByKey({});

    if (clientRef.current) {
      try {
        await clientRef.current.disconnect();
      } catch {
        // ignore
      } finally {
        clientRef.current = null;
      }
    }

    const scopes = (
      process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_SCOPES ??
      "operator.read,operator.write"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const wsUrl = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL ?? "";
    if (!wsUrl) {
      setStatus("error");
      setError("Missing NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL");
      return;
    }

    const client = new OpenClawBrowserGatewayClient(
      {
        wsUrl,
        protocol:
          process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_PROTOCOL === "jsonrpc"
            ? "jsonrpc"
            : "req",
        authToken: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_AUTH_TOKEN,
        password: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_PASSWORD,
        clientId: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_ID ?? "cli",
        clientMode:
          process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_MODE ?? "webchat",
        clientPlatform:
          process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_PLATFORM ?? "web",
        role: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_ROLE ?? "operator",
        scopes,
        subscribeOnConnect:
          process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CHAT_SUBSCRIBE === "true",
        subscribeMethod:
          process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_SUBSCRIBE_METHOD ??
          "chat.subscribe",
      },
      async (event) => {
        // We intentionally do not mirror these events into Convex on the /chat page.
        // This view is only for listing active sessions.
        const e = asRecord(event);
        if (!e) return;
        const eventName =
          (typeof e.event === "string" && e.event) ||
          (typeof e.type === "string" && e.type) ||
          "";
        if (eventName !== "health") return;
        const payload = e.payload;
        const rows = pickRecentSessionsFromHealth(payload);
        if (rows.length > 0) setSessions(rows);
      },
    );

    clientRef.current = client;
    try {
      await client.connect();
      setStatus("connected");

      // Proactively request health if the gateway supports it.
      // Different deployments may expose different method names, so we try a few.
      const candidates = ["health.get", "health", "gateway.health"];
      for (const method of candidates) {
        try {
          await client.request(method, {});
          break;
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void connect();
    return () => {
      void clientRef.current?.disconnect();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-effort: fetch a useful "last message" snippet per session (for the top N).
  useEffect(() => {
    if (status !== "connected") return;
    if (!clientRef.current) return;
    if (otherSessions.length === 0) return;

    let cancelled = false;

    const client = clientRef.current;
    const keys = otherSessions.slice(0, 20).map((s) => s.key);
    const missing = keys.filter((k) => !detailsByKey[k]);
    if (missing.length === 0) return;

    const run = async () => {
      // Concurrency limiter to avoid hammering the gateway.
      const concurrency = 4;
      let idx = 0;
      const workers = Array.from({ length: concurrency }).map(async () => {
        while (!cancelled) {
          const key = missing[idx++];
          if (!key) return;

          setDetailsByKey((prev) => ({
            ...prev,
            [key]: { loading: true },
          }));

          try {
            const history = await client.getChatHistory({ sessionKey: key, limit: 8 });
            const display = extractDisplayMessagesFromHistory(history);
            const last = display.length > 0 ? display[display.length - 1] : null;

            setDetailsByKey((prev) => ({
              ...prev,
              [key]: {
                loading: false,
                snippet: last?.content?.trim()?.slice(0, 140) ?? undefined,
                role: last?.role,
                at: last?.eventAt,
              },
            }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setDetailsByKey((prev) => ({
              ...prev,
              [key]: { loading: false, error: msg },
            }));
          }
        }
      });

      await Promise.all(workers);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [status, otherSessions, detailsByKey]);

  if (status === "error") {
    return (
      <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-status-blocked" />
            <p className="text-sm font-semibold text-text-primary">
              OpenClaw Sessions
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => void connect()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        </div>
        <p className="mt-2 text-xs text-status-blocked break-words">
          {error ?? "Failed to connect to OpenClaw Gateway."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity
            className={cn(
              "h-4 w-4",
              status === "connected" ? "text-status-active" : "text-text-muted",
            )}
          />
          <p className="text-sm font-semibold text-text-primary">
            Other Sessions
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => void connect()}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {otherSessions.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">
          No other active sessions found.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {otherSessions.slice(0, 40).map((s) => (
            <Link
              key={s.key}
              href={`/chat/session/${encodeURIComponent(s.key)}`}
              className="block"
            >
              <div className="group flex items-center justify-between gap-3 rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 transition-smooth hover:border-border-hover">
                <div className="min-w-0 flex items-start gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-secondary text-sm">
                    {lookupAgent(s.key)?.emoji ?? "💬"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-text-primary truncate">
                        {lookupAgent(s.key)?.name ?? prettySessionLabel(s.key)}
                      </p>
                      <span className="rounded-md border border-border-default bg-bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-dim">
                        {sessionKind(s.key)}
                      </span>
                    </div>
                    {detailsByKey[s.key]?.snippet ? (
                      <p className="mt-0.5 text-[11px] text-text-dim line-clamp-2">
                        {detailsByKey[s.key].snippet}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-text-dim truncate">
                        {s.key}
                      </p>
                    )}
                  </div>
                </div>
                {typeof s.age === "number" ? (
                  <span className="shrink-0 text-[11px] text-text-muted">
                    {formatAgeMinutes(s.age)}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
