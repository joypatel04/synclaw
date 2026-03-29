"use client";

import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, getRunStatusColor } from "@/lib/cron-utils";
import {
  type GatewayProtocol,
  OpenClawBrowserGatewayClient,
} from "@/lib/openclaw-gateway-client";
import type { CronRun } from "./types";

function toGatewayProtocol(value: string): GatewayProtocol {
  return value === "jsonrpc" ? "jsonrpc" : "req";
}

const DEFAULT_CRON_GATEWAY_SCOPES = [
  "operator.read",
  "operator.write",
  "operator.admin",
] as const;

/** Same fields as workspace OpenClaw client config (browser gateway connect). */
export type CronRunGatewayConfig = {
  wsUrl: string;
  protocol: string;
  authToken?: string;
  password?: string;
  forceDisableDeviceAuth?: boolean;
  clientId?: string;
  clientMode?: string;
  clientPlatform?: string;
  role?: string;
  scopes?: string[];
  subscribeMethod?: string;
};

interface CronRunHistoryProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required to load history against the workspace gateway (not a public env URL). */
  gatewayConfig: CronRunGatewayConfig | null;
}

export function CronRunHistory({
  jobId,
  open,
  onOpenChange,
  gatewayConfig,
}: CronRunHistoryProps) {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !jobId) return;

    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId, page, gatewayConfig]);

  const loadRuns = async () => {
    if (!jobId) return;
    if (!gatewayConfig?.wsUrl) {
      setError(
        "OpenClaw gateway is not configured. Set it under Settings → OpenClaw.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = new OpenClawBrowserGatewayClient(
        {
          wsUrl: gatewayConfig.wsUrl,
          protocol: toGatewayProtocol(gatewayConfig.protocol),
          authToken: gatewayConfig.authToken,
          password: gatewayConfig.password,
          forceDisableDeviceAuth: gatewayConfig.forceDisableDeviceAuth,
          clientId: gatewayConfig.clientId ?? "openclaw-control-ui",
          clientMode: gatewayConfig.clientMode ?? "webchat",
          clientPlatform: gatewayConfig.clientPlatform ?? "web",
          role: gatewayConfig.role ?? "operator",
          scopes: gatewayConfig.scopes ?? [...DEFAULT_CRON_GATEWAY_SCOPES],
          subscribeOnConnect: false,
          subscribeMethod: gatewayConfig.subscribeMethod ?? "chat.subscribe",
        },
        async () => {
          // No-op event handler
        },
      );

      await client.connect();

      const result = await client.request("cron.runs", {
        jobId,
        limit: 50,
        offset: page * 50,
      });

      await client.disconnect();

      const payload = (result as { payload?: { runs?: CronRun[] } })?.payload;
      if (payload && Array.isArray(payload.runs)) {
        const runsArray = payload.runs;
        if (page === 0) {
          setRuns(runsArray);
        } else {
          setRuns((prev) => [...prev, ...runsArray]);
        }
        setHasMore(runsArray.length >= 50);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load run history",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (runId: string) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  const loadMore = () => {
    setPage((prev) => prev + 1);
  };

  const getRunIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-teal-500" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-text-muted" />;
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Run History</DrawerTitle>
          <DrawerDescription>
            Execution history for this cron job
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="h-[calc(85vh-140px)] px-4">
          {loading && runs.length === 0 ? (
            <div className="space-y-3 py-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-text-muted">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <p className="text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(0)}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : runs.length === 0 ? (
            <div className="py-8 text-center text-text-muted">
              <Clock className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">No runs yet</p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {(runs || []).map((run) => (
                <div
                  key={run.id}
                  className="rounded-lg border border-border-default bg-bg-secondary/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getRunIcon(run.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{run.id}</span>
                          <Badge
                            variant="outline"
                            className={getRunStatusColor(run.status)}
                          >
                            {run.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          <div>Started: {formatTimestamp(run.startedAt)}</div>
                          <div>Duration: {formatDuration(run.duration)}</div>
                        </div>
                      </div>
                    </div>
                    {(run.error || run.output) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(run.id)}
                      >
                        {expandedRuns.has(run.id) ? "Hide" : "Show"} Details
                      </Button>
                    )}
                  </div>

                  {expandedRuns.has(run.id) && (
                    <div className="mt-3 space-y-2">
                      {run.error && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                            {run.error}
                          </AlertDescription>
                        </Alert>
                      )}
                      {run.output && (
                        <div className="rounded border border-border-default bg-bg-tertiary/50 p-3">
                          <p className="mb-1 text-xs font-semibold text-text-muted">
                            Output:
                          </p>
                          <pre className="font-mono text-xs whitespace-pre-wrap">
                            {run.output}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {hasMore && (
                <div className="pt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
