"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CronJobDialog } from "@/components/admin/cron/CronJobDialog";
import { CronJobTable } from "@/components/admin/cron/CronJobTable";
import { CronRunHistory } from "@/components/admin/cron/CronRunHistory";
import type { CronJob } from "@/components/admin/cron/types";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { OpenClawBrowserGatewayClient } from "@/lib/openclaw-gateway-client";
import { cn } from "@/lib/utils";

// Simple toast notification state
interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

function useToast() {
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = useCallback(
    ({
      title,
      variant,
    }: {
      title: string;
      variant?: "default" | "destructive";
    }) => {
      setToast({
        show: true,
        message: title,
        type: variant === "destructive" ? "error" : "success",
      });
      setTimeout(
        () => setToast({ show: false, message: "", type: "success" }),
        3000,
      );
    },
    [],
  );

  const ToastComponent = toast.show ? (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom-4",
        toast.type === "success"
          ? "bg-teal-500 text-white"
          : "bg-red-500 text-white",
      )}
    >
      {toast.type === "success" ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  ) : null;

  return { toast: showToast, ToastComponent };
}

// Inner component that uses useWorkspace (must be rendered inside AppLayout)
function CronJobsPageContent() {
  const { workspace, canManage } = useWorkspace();
  const openclawConfig = useQuery(
    api.openclaw.getClientConfig,
    workspace ? { workspaceId: workspace._id } : "skip",
  );

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deleteConfirmJob, setDeleteConfirmJob] = useState<CronJob | null>(
    null,
  );
  const [runConfirmJob, setRunConfirmJob] = useState<CronJob | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const gatewayRef = useRef<OpenClawBrowserGatewayClient | null>(null);
  const fetchJobsRef = useRef<() => Promise<void>>(async () => {});
  const { toast, ToastComponent } = useToast();

  const fetchJobs = useCallback(async () => {
    const client = gatewayRef.current;
    if (!client) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await client.request("cron.list", {
        includeDisabled: true,
      });
      setJobs(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");
      toast({ title: "Failed to fetch jobs", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  fetchJobsRef.current = fetchJobs;

  // Initialize gateway client (same connect shape as chat — OpenClaw validates client.id)
  useEffect(() => {
    if (!openclawConfig || !openclawConfig.wsUrl) return;
    if ((openclawConfig.transportMode ?? "direct_ws") === "connector") {
      setError(
        "Connector mode is not supported for cron management in the browser yet. Use direct WebSocket gateway settings or Chat from this app.",
      );
      return;
    }

    const initGateway = async () => {
      try {
        setError(null);
        const client = new OpenClawBrowserGatewayClient(
          {
            wsUrl: openclawConfig.wsUrl,
            protocol: openclawConfig.protocol,
            authToken: openclawConfig.authToken,
            password: openclawConfig.password,
            forceDisableDeviceAuth:
              (openclawConfig.deploymentMode ?? "manual") === "managed",
            clientId: openclawConfig.clientId,
            clientMode: openclawConfig.clientMode,
            clientPlatform: openclawConfig.clientPlatform,
            role: openclawConfig.role,
            scopes: openclawConfig.scopes,
            subscribeOnConnect: false,
            subscribeMethod: openclawConfig.subscribeMethod,
          },
          async () => {},
        );

        await client.connect();
        gatewayRef.current = client;
        void fetchJobsRef.current();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to connect to gateway",
        );
      }
    };

    void initGateway();

    return () => {
      gatewayRef.current?.disconnect().catch(console.error);
      gatewayRef.current = null;
    };
  }, [openclawConfig]);

  // Refresh jobs
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchJobs();
    setIsRefreshing(false);
  };

  // Create or update job
  const handleSaveJob = async (job: Partial<CronJob>) => {
    const client = gatewayRef.current;
    if (!client) return;

    setIsSaving(true);
    try {
      if (job.id) {
        // Update existing job
        await client.request("cron.update", {
          jobId: job.id,
          patch: {
            name: job.name,
            enabled: job.enabled,
            schedule: job.schedule,
            payload: job.payload,
            delivery: job.delivery,
            sessionTarget: job.sessionTarget,
          },
        });
        toast({ title: "Job updated successfully" });
      } else {
        // Create new job
        await client.request("cron.add", {
          job: {
            name: job.name,
            enabled: job.enabled,
            schedule: job.schedule,
            payload: job.payload,
            delivery: job.delivery,
            sessionTarget: job.sessionTarget,
          },
        });
        toast({ title: "Job created successfully" });
      }
      await fetchJobs();
      setSelectedJob(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save job";
      setError(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle job enabled/disabled
  const handleToggleJob = async (job: CronJob, enabled: boolean) => {
    const client = gatewayRef.current;
    if (!client) return;

    try {
      await client.request("cron.update", {
        jobId: job.id,
        patch: { enabled },
      });
      toast({ title: `Job ${enabled ? "enabled" : "disabled"}` });
      await fetchJobs();
    } catch (_err) {
      toast({ title: "Failed to update job", variant: "destructive" });
    }
  };

  // Run job now
  const handleRunJob = async (job: CronJob) => {
    const client = gatewayRef.current;
    if (!client) return;

    setIsRunning(true);
    setRunConfirmJob(null);
    try {
      await client.request("cron.run", {
        jobId: job.id,
        runMode: "force",
      });
      toast({ title: "Job triggered successfully" });
    } catch (_err) {
      toast({ title: "Failed to trigger job", variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  // Delete job
  const handleDeleteJob = async (job: CronJob) => {
    const client = gatewayRef.current;
    if (!client) return;

    setDeleteConfirmJob(null);
    try {
      await client.request("cron.remove", {
        jobId: job.id,
      });
      toast({ title: "Job deleted successfully" });
      await fetchJobs();
    } catch (_err) {
      toast({ title: "Failed to delete job", variant: "destructive" });
    }
  };

  // Handlers
  const handleEdit = (job: CronJob) => {
    setSelectedJob(job);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedJob(null);
    setIsDialogOpen(true);
  };

  const handleViewHistory = (job: CronJob) => {
    setHistoryJob(job);
    setIsHistoryOpen(true);
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-lg font-semibold text-text-primary mb-2">
          Cron jobs
        </h1>
        <p className="text-sm text-text-muted mb-4">
          Workspace admins and owners can manage gateway cron jobs from here.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/openclaw">Back to OpenClaw settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-7xl p-3 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary">
                Cron Jobs
              </h1>
              <p className="text-xs text-text-muted hidden sm:block">
                Manage scheduled tasks and automation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8"
            >
              <RefreshCw
                className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              className="h-8 gap-2 bg-accent-orange hover:bg-accent-orange/90"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Job</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 mb-6">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Gateway Not Configured */}
        {!openclawConfig?.wsUrl && !isLoading && (
          <div className="rounded-lg border border-border-default bg-bg-secondary p-8 text-center">
            <Clock className="h-12 w-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              OpenClaw Gateway Not Configured
            </h3>
            <p className="text-sm text-text-muted mb-4">
              Please configure your OpenClaw Gateway connection in settings.
            </p>
            <Button asChild variant="outline">
              <Link href="/settings/openclaw">Configure Gateway</Link>
            </Button>
          </div>
        )}

        {/* Jobs Table */}
        {openclawConfig?.wsUrl && (
          <CronJobTable
            jobs={jobs}
            isLoading={isLoading}
            onEdit={handleEdit}
            onToggle={handleToggleJob}
            onRun={async (job) => setRunConfirmJob(job)}
            onDelete={async (job) => setDeleteConfirmJob(job)}
            onViewHistory={handleViewHistory}
          />
        )}
      </div>

      {/* Add/Edit Dialog */}
      <CronJobDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        job={selectedJob}
        onSave={handleSaveJob}
        isSaving={isSaving}
      />

      {/* Run History Sheet */}
      <CronRunHistory
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        jobId={historyJob?.id ?? null}
        gatewayConfig={
          openclawConfig?.wsUrl &&
          (openclawConfig.transportMode ?? "direct_ws") !== "connector"
            ? {
                wsUrl: openclawConfig.wsUrl,
                protocol: openclawConfig.protocol,
                authToken: openclawConfig.authToken,
                password: openclawConfig.password,
                forceDisableDeviceAuth:
                  (openclawConfig.deploymentMode ?? "manual") === "managed",
                clientId: openclawConfig.clientId,
                clientMode: openclawConfig.clientMode,
                clientPlatform: openclawConfig.clientPlatform,
                role: openclawConfig.role,
                scopes: openclawConfig.scopes,
                subscribeMethod: openclawConfig.subscribeMethod,
              }
            : null
        }
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmJob}
        onOpenChange={() => setDeleteConfirmJob(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cron Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "
              {deleteConfirmJob?.name || "this job"}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteConfirmJob && handleDeleteJob(deleteConfirmJob)
              }
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run Now Confirmation */}
      <AlertDialog
        open={!!runConfirmJob}
        onOpenChange={() => setRunConfirmJob(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run Job Now</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to trigger "
              {runConfirmJob?.name || "this job"}" immediately?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => runConfirmJob && handleRunJob(runConfirmJob)}
              disabled={isRunning}
              className="bg-accent-orange hover:bg-accent-orange/90"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toast Notifications */}
      {ToastComponent}
    </>
  );
}

// Main page component - doesn't use useWorkspace directly
export default function CronJobsPage() {
  return (
    <AppLayout>
      <CronJobsPageContent />
    </AppLayout>
  );
}
