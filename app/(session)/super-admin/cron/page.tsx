"use client";

import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CronJobDialog } from "@/components/admin/cron/CronJobDialog";
import { CronJobsTable } from "@/components/admin/cron/CronJobsTable";
import type { CronJob } from "@/components/admin/cron/types";
import type { CronRunGatewayConfig } from "@/components/admin/cron/CronRunHistory";

const SUPER_ADMIN_CRON_GATEWAY: CronRunGatewayConfig | null =
  typeof process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL === "string" &&
  process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL.length > 0
    ? {
        wsUrl: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL,
        protocol: "req",
        clientMode: "webchat",
        clientPlatform: "web",
        role: "operator",
        scopes: ["operator.read", "operator.write", "operator.admin"],
        subscribeMethod: "chat.subscribe",
      }
    : null;
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { OpenClawBrowserGatewayClient } from "@/lib/openclaw-gateway-client";

export default function CronJobManagementPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getClient = async () => {
    const client = new OpenClawBrowserGatewayClient(
      {
        wsUrl: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL || "",
        protocol: "req",
        // Omit clientId in webchat mode so the client uses openclaw-control-ui (gateway schema).
        clientMode: "webchat",
        clientPlatform: "web",
        role: "operator",
        scopes: ["operator.read", "operator.write", "operator.admin"],
        subscribeOnConnect: false,
        subscribeMethod: "chat.subscribe",
      },
      async () => {
        // No-op event handler
      },
    );
    await client.connect();
    return client;
  };

  const loadJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      const client = await getClient();

      const result = await client.request("cron.list", {});

      await client.disconnect();

      const payload = (result as { payload?: { jobs?: CronJob[] } })?.payload;
      if (payload && Array.isArray(payload.jobs)) {
        setJobs(payload.jobs);
      } else {
        setJobs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  const handleCreate = () => {
    setEditingJob(null);
    setDialogOpen(true);
  };

  const handleEdit = (job: CronJob) => {
    setEditingJob(job);
    setDialogOpen(true);
  };

  const handleSave = async (jobData: Partial<CronJob>) => {
    setSaving(true);

    try {
      const client = await getClient();

      if (editingJob) {
        // Update existing job
        await client.request("cron.update", {
          jobId: editingJob.id,
          job: jobData,
        });
        toast.success("Cron job updated successfully");
      } else {
        // Create new job
        await client.request("cron.create", {
          job: jobData,
        });
        toast.success("Cron job created successfully");
      }

      await client.disconnect();

      setDialogOpen(false);
      setEditingJob(null);
      await loadJobs();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save cron job",
      );
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      const client = await getClient();

      await client.request("cron.delete", {
        jobId,
      });

      await client.disconnect();

      toast.success("Cron job deleted successfully");
      await loadJobs();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete cron job",
      );
      throw err;
    }
  };

  const handleToggle = async (job: CronJob) => {
    try {
      const client = await getClient();

      await client.request("cron.toggle", {
        jobId: job.id,
        enabled: !job.enabled,
      });

      await client.disconnect();

      toast.success(
        `Cron job ${job.enabled ? "disabled" : "enabled"} successfully`,
      );
      await loadJobs();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to toggle cron job",
      );
      throw err;
    }
  };

  const handleTrigger = async (jobId: string) => {
    try {
      const client = await getClient();

      await client.request("cron.trigger", {
        jobId,
      });

      await client.disconnect();

      toast.success("Cron job triggered successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to trigger cron job",
      );
      throw err;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cron Job Management</h1>
            <p className="mt-1 text-sm text-text-muted">
              Automate tasks with scheduled jobs
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Job
            </Button>
          </div>
        </div>

        <CronJobsTable
          jobs={jobs}
          loading={loading}
          error={error || undefined}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggle={handleToggle}
          onTrigger={handleTrigger}
          onRefresh={loadJobs}
          gatewayConfig={SUPER_ADMIN_CRON_GATEWAY}
        />

        <CronJobDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          job={editingJob}
          onSave={handleSave}
          isSaving={saving}
        />
      </div>
    </AppLayout>
  );
}
