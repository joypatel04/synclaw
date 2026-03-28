import { parseExpression } from "cron-parser";
import { formatDistanceToNow } from "date-fns";
import type { CronJob, CronScheduleType } from "@/components/admin/cron/types";

/**
 * Validate a cron expression
 */
export function validateCronExpression(expr: string): {
  valid: boolean;
  error?: string;
} {
  try {
    parseExpression(expr);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid cron expression",
    };
  }
}

/**
 * Get cron presets for common schedules
 */
export function getCronPresets(): { label: string; expr: string }[] {
  return [
    { label: "Every minute", expr: "* * * * *" },
    { label: "Every hour", expr: "0 * * * *" },
    { label: "Every day at midnight", expr: "0 0 * * *" },
    { label: "Every Sunday at midnight", expr: "0 0 * * 0" },
    { label: "Every Monday at 9am", expr: "0 9 * * 1" },
    { label: "Every weekday at 9am", expr: "0 9 * * 1-5" },
    { label: "Every 6 hours", expr: "0 */6 * * *" },
    { label: "Every 30 minutes", expr: "*/30 * * * *" },
  ];
}

/**
 * Get interval presets for "every" schedule type
 */
export function getIntervalPresets(): { label: string; ms: number }[] {
  return [
    { label: "1 minute", ms: 60 * 1000 },
    { label: "5 minutes", ms: 5 * 60 * 1000 },
    { label: "15 minutes", ms: 15 * 60 * 1000 },
    { label: "30 minutes", ms: 30 * 60 * 1000 },
    { label: "1 hour", ms: 60 * 60 * 1000 },
    { label: "6 hours", ms: 6 * 60 * 60 * 1000 },
    { label: "12 hours", ms: 12 * 60 * 60 * 1000 },
    { label: "1 day", ms: 24 * 60 * 60 * 1000 },
    { label: "1 week", ms: 7 * 24 * 60 * 60 * 1000 },
  ];
}

/**
 * Calculate next run time for a schedule
 */
export function getNextRunTime(schedule: any): string {
  try {
    if (!schedule) return "Unknown";

    switch (schedule.kind) {
      case "cron": {
        const interval = parseExpression(schedule.expr || "* * * * *", {
          tz: schedule.tz || "UTC",
        });
        const next = interval.next().toDate();
        return formatDistanceToNow(next, { addSuffix: true });
      }
      case "every": {
        const ms = schedule.everyMs || 0;
        if (ms <= 0) return "Invalid interval";
        const now = Date.now();
        const next = now + ms;
        return formatDistanceToNow(next, { addSuffix: true });
      }
      case "at": {
        const at = schedule.at;
        if (!at) return "Not set";
        const date = new Date(at);
        if (date.getTime() < Date.now()) {
          return "Expired";
        }
        return formatDistanceToNow(date, { addSuffix: true });
      }
      default:
        return "Unknown";
    }
  } catch (error) {
    return "Error calculating";
  }
}

/**
 * Format schedule as human-readable string
 */
export function formatSchedule(job: CronJob): string {
  const { schedule } = job;
  if (!schedule) return "Not set";

  switch (schedule.kind) {
    case "cron":
      return schedule.expr || "* * * * *";
    case "every": {
      const ms = schedule.everyMs || 0;
      const presets = getIntervalPresets();
      const preset = presets.find((p) => p.ms === ms);
      if (preset) return preset.label;
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return `Every ${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `Every ${minutes}m`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `Every ${hours}h`;
      const days = Math.floor(hours / 24);
      return `Every ${days}d`;
    }
    case "at":
      return schedule.at ? new Date(schedule.at).toLocaleString() : "Not set";
    default:
      return "Unknown";
  }
}

/**
 * Get schedule type badge color
 */
export function getScheduleTypeColor(type: CronScheduleType): string {
  switch (type) {
    case "cron":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "every":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case "at":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    default:
      return "bg-bg-tertiary text-text-muted";
  }
}

/**
 * Get run status badge color
 */
export function getRunStatusColor(status: "success" | "failed" | "running" | "never"): string {
  switch (status) {
    case "success":
      return "bg-teal-500/10 text-teal-500 border-teal-500/20";
    case "failed":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "running":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "never":
      return "bg-bg-tertiary text-text-muted";
    default:
      return "bg-bg-tertiary text-text-muted";
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms?: number): string {
  if (!ms) return "-";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
