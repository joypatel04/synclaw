import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
    case "done":
      return "text-status-active";
    case "idle":
      return "text-status-idle";
    case "blocked":
      return "text-status-blocked";
    case "error":
      return "text-status-blocked";
    case "offline":
      return "text-text-muted";
    case "review":
      return "text-status-review";
    case "in_progress":
      return "text-accent-orange";
    default:
      return "text-text-secondary";
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case "active":
    case "done":
      return "bg-status-active/20 text-status-active";
    case "idle":
      return "bg-status-idle/20 text-status-idle";
    case "blocked":
      return "bg-status-blocked/20 text-status-blocked";
    case "error":
      return "bg-status-blocked/20 text-status-blocked";
    case "offline":
      return "bg-text-muted/20 text-text-muted";
    case "review":
      return "bg-status-review/20 text-status-review";
    case "in_progress":
      return "bg-accent-orange/20 text-accent-orange";
    case "assigned":
      return "bg-teal/20 text-teal";
    case "inbox":
      return "bg-text-secondary/20 text-text-secondary";
    default:
      return "bg-text-muted/20 text-text-muted";
  }
}

export function getPriorityColor(
  priority: string,
): string {
  switch (priority) {
    case "high":
      return "text-status-blocked";
    case "medium":
      return "text-status-review";
    case "low":
      return "text-teal";
    case "none":
      return "text-text-muted";
    default:
      return "text-text-muted";
  }
}

export function getPriorityBgColor(
  priority: string,
): string {
  switch (priority) {
    case "high":
      return "bg-status-blocked/20 text-status-blocked border-status-blocked/30";
    case "medium":
      return "bg-status-review/20 text-status-review border-status-review/30";
    case "low":
      return "bg-teal/20 text-teal border-teal/30";
    case "none":
      return "bg-text-muted/20 text-text-muted border-text-muted/30";
    default:
      return "bg-text-muted/20 text-text-muted border-text-muted/30";
  }
}
