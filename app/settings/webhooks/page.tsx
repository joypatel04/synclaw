"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
  Copy,
  RotateCw,
  Settings,
  Trash2,
  Webhook,
  ShieldAlert,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WebhookCreateDialog } from "@/components/settings/WebhookCreateDialog";
import { WorkspaceSettingsTabs } from "@/components/settings/WorkspaceSettingsTabs";
import { WEBHOOKS_ENABLED } from "@/lib/features";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function WebhooksContent() {
  const { workspaceId, canManage } = useWorkspace();
  const readOnly = !canManage;
  const [statusFilter, setStatusFilter] = useState<
    "all" | "received" | "processed" | "failed" | "ignored"
  >("all");
  const webhooks = useQuery(api.webhooks.listWebhooks, { workspaceId }) ?? [];
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(
    null,
  );
  const selectedWebhook = useMemo(
    () =>
      webhooks.find((w: any) => w._id === selectedWebhookId) ??
      webhooks[0] ??
      null,
    [selectedWebhookId, webhooks],
  );
  const payloads =
    useQuery(
      api.webhooks.listPayloads,
      selectedWebhook
        ? {
            workspaceId,
            webhookId: selectedWebhook._id,
            page: 1,
            pageSize: 20,
            status: statusFilter === "all" ? undefined : statusFilter,
          }
        : "skip",
    ) ?? null;
  const stats =
    useQuery(
      api.webhooks.getStats,
      selectedWebhook
        ? {
            workspaceId,
            webhookId: selectedWebhook._id,
          }
        : "skip",
    ) ?? null;

  const createWebhook = useMutation(api.webhooks.createWebhook);
  const updateWebhook = useMutation(api.webhooks.updateWebhook);
  const rotateSecret = useMutation(api.webhooks.rotateWebhookSecret);
  const deleteWebhook = useMutation(api.webhooks.deleteWebhook);
  const reprocessPayload = useMutation(api.webhooks.reprocessWebhookPayload);

  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [revealSecret, setRevealSecret] = useState<{
    secret: string;
    endpointUrl: string;
  } | null>(null);
  const [activePayloadId, setActivePayloadId] = useState<string | null>(null);

  if (!WEBHOOKS_ENABLED) {
    return (
      <div className="mx-auto max-w-2xl p-3 sm:p-6">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
          <h2 className="text-base font-semibold text-text-primary">
            Webhooks coming soon
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Webhook automation is currently disabled.
          </p>
        </div>
      </div>
    );
  }

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  return (
    <div className="mx-auto max-w-4xl p-3 sm:p-6">
      <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
          <Settings className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Workspace Settings
          </h1>
          <p className="text-xs text-text-muted hidden sm:block">
            Webhook ingestion and automation
          </p>
        </div>
      </div>

      <WorkspaceSettingsTabs active="webhooks" canManage={canManage} />

      <div className="space-y-4">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Webhook className="h-4 w-4 text-accent-orange" />
                Webhooks ({webhooks.length})
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Inbound endpoint: /api/v1/workspaces/webhooks/ingest
              </p>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setShowCreate(true)}
              disabled={readOnly}
            >
              Create Webhook
            </Button>
          </div>
          {readOnly ? (
            <div className="mt-3 rounded-lg border border-border-default bg-bg-primary p-3">
              <p className="text-xs text-text-muted flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5" />
                Read-only mode. Owner/admin can create, rotate, delete, or
                reprocess.
              </p>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {webhooks.length === 0 ? (
              <p className="text-sm text-text-muted">
                No webhooks yet. Create one to start ingesting external events.
              </p>
            ) : (
              webhooks.map((webhook: any) => (
                <div
                  key={webhook._id}
                  className={`rounded-lg border p-3 ${
                    selectedWebhook?._id === webhook._id
                      ? "border-accent-orange/50 bg-accent-orange/5"
                      : "border-border-default bg-bg-primary"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      className="cursor-pointer"
                      onClick={() => setSelectedWebhookId(webhook._id)}
                    >
                      <p className="text-sm font-semibold text-text-primary">
                        {webhook.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {webhook.actionTemplate} ·{" "}
                        {webhook.enabled ? "enabled" : "disabled"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-text-muted">
                          Enabled
                        </Label>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={readOnly}
                          onClick={() =>
                            void updateWebhook({
                              workspaceId,
                              webhookId: webhook._id,
                              patch: { enabled: !webhook.enabled },
                            })
                          }
                        >
                          {webhook.enabled ? "On" : "Off"}
                        </Button>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-text-muted hover:text-text-primary"
                        onClick={() => void copy(webhook.endpointUrl)}
                        title="Copy endpoint URL"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-text-muted hover:text-text-primary"
                        disabled={readOnly}
                        onClick={async () => {
                          const result = await rotateSecret({
                            workspaceId,
                            webhookId: webhook._id,
                          });
                          setRevealSecret({
                            secret: result.secret,
                            endpointUrl: webhook.endpointUrl,
                          });
                        }}
                        title="Rotate secret"
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-status-blocked hover:text-status-blocked"
                        disabled={readOnly}
                        onClick={() =>
                          void deleteWebhook({
                            workspaceId,
                            webhookId: webhook._id,
                          })
                        }
                        title="Delete webhook"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedWebhook ? (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-text-primary">
              Payloads for {selectedWebhook.name}
            </h3>
            {stats ? (
              <p className="mt-1 text-xs text-text-muted">
                total: {stats.total} · processed: {stats.processed} · failed:{" "}
                {stats.failed} · ignored: {stats.ignored}
              </p>
            ) : null}
            <div className="mt-3 w-full max-w-xs">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(
                    value as
                      | "all"
                      | "received"
                      | "processed"
                      | "failed"
                      | "ignored",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default text-text-primary">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 space-y-2">
              {(payloads?.items ?? []).map((payload: any) => (
                <div
                  key={payload._id}
                  className="rounded-lg border border-border-default bg-bg-primary p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-text-primary truncate">
                        {payload.providerEventId ?? "no-provider-event-id"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {payload.status} ·{" "}
                        {new Date(payload.receivedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActivePayloadId(payload._id)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        disabled={readOnly}
                        onClick={() =>
                          void reprocessPayload({
                            workspaceId,
                            payloadId: payload._id,
                          })
                        }
                      >
                        Reprocess
                      </Button>
                    </div>
                  </div>
                  {payload.errorMessage ? (
                    <p className="mt-2 text-xs text-status-blocked">
                      {payload.errorMessage}
                    </p>
                  ) : null}
                </div>
              ))}
              {!payloads || payloads.items.length === 0 ? (
                <p className="text-sm text-text-muted">No payloads yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <WebhookCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        isSaving={isSaving}
        onSubmit={async (args) => {
          setIsSaving(true);
          try {
            const result = await createWebhook({
              workspaceId,
              ...args,
            });
            setRevealSecret({
              secret: result.secret,
              endpointUrl: result.endpointUrl,
            });
            setShowCreate(false);
            setSelectedWebhookId(result.webhookId);
          } finally {
            setIsSaving(false);
          }
        }}
      />

      {revealSecret ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl border border-border-default bg-bg-secondary p-5">
            <h3 className="text-base font-semibold text-text-primary">
              Save this webhook secret now
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              This secret is shown once. It is not retrievable later.
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-border-default bg-bg-primary p-3">
                <p className="text-xs text-text-muted mb-1">Endpoint URL</p>
                <p className="font-mono text-xs text-text-primary break-all">
                  {revealSecret.endpointUrl}
                </p>
              </div>
              <div className="rounded-lg border border-border-default bg-bg-primary p-3">
                <p className="text-xs text-text-muted mb-1">Secret</p>
                <p className="font-mono text-xs text-text-primary break-all">
                  {revealSecret.secret}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  void copy(
                    `${revealSecret.endpointUrl}\nX-Synclaw-Webhook-Secret: ${revealSecret.secret}`,
                  )
                }
              >
                Copy both
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setRevealSecret(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {activePayloadId ? (
        <PayloadViewer
          workspaceId={workspaceId}
          payloadId={activePayloadId}
          onClose={() => setActivePayloadId(null)}
        />
      ) : null}
    </div>
  );
}

function PayloadViewer({
  workspaceId,
  payloadId,
  onClose,
}: {
  workspaceId: any;
  payloadId: any;
  onClose: () => void;
}) {
  const payload = useQuery(api.webhooks.getPayload, { workspaceId, payloadId });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border-default bg-bg-secondary p-5">
        <h3 className="text-base font-semibold text-text-primary">
          Payload detail
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border-default bg-bg-primary p-3">
            <p className="text-xs text-text-muted">Status</p>
            <p className="text-sm text-text-primary">
              {payload?.status ?? "-"}
            </p>
          </div>
          <div className="rounded-lg border border-border-default bg-bg-primary p-3">
            <p className="text-xs text-text-muted">Content-Type</p>
            <p className="text-sm text-text-primary">
              {payload?.contentType ?? "-"}
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-border-default bg-bg-primary p-3">
          <p className="text-xs text-text-muted mb-1">Headers</p>
          <pre className="max-h-40 overflow-auto text-xs text-text-primary font-mono whitespace-pre-wrap">
            {JSON.stringify(payload?.headers ?? {}, null, 2)}
          </pre>
        </div>
        <div className="mt-3 rounded-lg border border-border-default bg-bg-primary p-3">
          <p className="text-xs text-text-muted mb-1">Payload</p>
          <pre className="max-h-72 overflow-auto text-xs text-text-primary font-mono whitespace-pre-wrap">
            {JSON.stringify(payload?.payload ?? {}, null, 2)}
          </pre>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  return (
    <AppLayout>
      <WebhooksContent />
    </AppLayout>
  );
}
