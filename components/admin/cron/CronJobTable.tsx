"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Play, Trash2, Edit, MoreHorizontal, History, Power, PowerOff } from "lucide-react";
import type { CronJob } from "./types";
import { getNextRunTime, formatSchedule, getScheduleTypeColor } from "@/lib/cron-utils";
import { cn } from "@/lib/utils";

interface CronJobTableProps {
  jobs: CronJob[];
  isLoading?: boolean;
  onEdit: (job: CronJob) => void;
  onToggle: (job: CronJob, enabled: boolean) => Promise<void>;
  onRun: (job: CronJob) => Promise<void>;
  onDelete: (job: CronJob) => void;
  onViewHistory: (job: CronJob) => void;
}

export function CronJobTable({
  jobs,
  isLoading,
  onEdit,
  onToggle,
  onRun,
  onDelete,
  onViewHistory,
}: CronJobTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border-hover border-t-transparent" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-text-muted mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-2">No cron jobs found</h3>
        <p className="text-sm text-text-muted">
          Create your first cron job to automate tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.name || "Unnamed Job"}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(getScheduleTypeColor(job.schedule.kind))}
                  >
                    {job.schedule.kind}
                  </Badge>
                </TableCell>
                <TableCell>
                  <code className="text-xs font-mono bg-bg-tertiary px-2 py-1 rounded">
                    {formatSchedule(job)}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      job.enabled
                        ? "bg-teal-500/10 text-teal-500 border-teal-500/20"
                        : "bg-bg-tertiary text-text-muted"
                    }
                  >
                    {job.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-text-muted">
                  {job.enabled ? getNextRunTime(job.schedule) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(job)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewHistory(job)}>
                        <History className="h-4 w-4 mr-2" />
                        View History
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {job.enabled ? (
                        <DropdownMenuItem onClick={() => onToggle(job, false)}>
                          <PowerOff className="h-4 w-4 mr-2" />
                          Disable
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onToggle(job, true)}>
                          <Power className="h-4 w-4 mr-2" />
                          Enable
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => onRun(job)}
                        disabled={!job.enabled}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Now
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(job)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
