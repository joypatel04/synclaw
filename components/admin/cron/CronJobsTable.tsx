"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Trash2,
  Edit,
  Clock,
  MoreVertical,
  RefreshCw,
  History,
  Power,
  PowerOff,
} from "lucide-react";
import type { CronJob } from "./types";
import { getNextRunTime, formatSchedule, getScheduleTypeColor } from "@/lib/cron-utils";
import { CronRunHistory } from "./CronRunHistory";

interface CronJobsTableProps {
  jobs: CronJob[];
  loading: boolean;
  error?: string;
  onEdit: (job: CronJob) => void;
  onDelete: (jobId: string) => Promise<void>;
  onToggle: (job: CronJob) => Promise<void>;
  onTrigger: (jobId: string) => Promise<void>;
  onRefresh: () => void;
}

export function CronJobsTable({
  jobs,
  loading,
  error,
  onEdit,
  onDelete,
  onToggle,
  onTrigger,
  onRefresh,
}: CronJobsTableProps) {
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [historyJobId, setHistoryJobId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteJobId) return;
    try {
      await onDelete(deleteJobId);
      setDeleteJobId(null);
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  };

  const handleToggle = async (job: CronJob) => {
    setToggling(job.id);
    try {
      await onToggle(job);
    } catch (error) {
      console.error("Failed to toggle job:", error);
    } finally {
      setToggling(null);
    }
  };

  const handleTrigger = async (jobId: string) => {
    setTriggering(jobId);
    try {
      await onTrigger(jobId);
    } catch (error) {
      console.error("Failed to trigger job:", error);
    } finally {
      setTriggering(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="mt-4"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border-default bg-bg-secondary/50 p-12">
        <Clock className="mb-4 h-12 w-12 text-text-muted" />
        <h3 className="mb-2 text-lg font-semibold">No cron jobs yet</h3>
        <p className="mb-4 text-sm text-text-muted">
          Create your first cron job to automate tasks
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border-default bg-bg-primary">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Schedule Type</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{job.name || "Unnamed Job"}</span>
                    <span className="text-xs text-text-muted">{job.id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={getScheduleTypeColor(job.schedule.kind)}
                  >
                    {job.schedule.kind}
                  </Badge>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-bg-secondary px-2 py-1 text-xs">
                    {formatSchedule(job)}
                  </code>
                </TableCell>
                <TableCell className="text-sm text-text-muted">
                  {job.enabled ? getNextRunTime(job.schedule) : "Disabled"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={job.enabled ? "default" : "secondary"}
                    className={
                      job.enabled
                        ? "bg-teal-500/10 text-teal-500 border-teal-500/20"
                        : "bg-bg-tertiary text-text-muted"
                    }
                  >
                    {job.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(job)}
                      disabled={toggling === job.id}
                    >
                      {toggling === job.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : job.enabled ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTrigger(job.id)}
                      disabled={triggering === job.id || !job.enabled}
                    >
                      {triggering === job.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setHistoryJobId(job.id)}
                        >
                          <History className="mr-2 h-4 w-4" />
                          View History
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(job)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteJobId(job.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteJobId !== null}
        onOpenChange={(open) => !open && setDeleteJobId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cron Job?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The cron job will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run History Drawer */}
      <CronRunHistory
        jobId={historyJobId}
        open={historyJobId !== null}
        onOpenChange={(open) => !open && setHistoryJobId(null)}
      />
    </>
  );
}
