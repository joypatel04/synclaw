"use client";

import { Timestamp } from "@/components/shared/Timestamp";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  CheckCircle,
  MessageSquare,
  Radio,
  RefreshCw,
  Zap,
  AlertTriangle,
  FileText,
} from "lucide-react";
import Link from "next/link";

const typeIcons = {
  task_created: Zap,
  task_updated: RefreshCw,
  message_sent: MessageSquare,
  agent_status: CheckCircle,
  broadcast_sent: Radio,
  mention_alert: AlertTriangle,
  document_created: FileText,
  document_updated: FileText,
};

const typeColors = {
  task_created: "text-accent-orange",
  task_updated: "text-teal",
  message_sent: "text-text-secondary",
  agent_status: "text-status-active",
  broadcast_sent: "text-status-review",
  mention_alert: "text-status-blocked",
  document_created: "text-text-secondary",
  document_updated: "text-text-secondary",
};

interface ActivityItemProps {
  activity: Doc<"activities">;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const Icon = typeIcons[activity.type] ?? Zap;
  const color = typeColors[activity.type] ?? "text-text-muted";

  return (
    <div className="group flex gap-3 rounded-lg px-3 py-2.5 transition-smooth hover:bg-bg-hover">
      <div className={cn("mt-0.5 shrink-0", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary leading-relaxed">
          {activity.message}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Timestamp time={activity.createdAt} />
          {activity.taskId && (
            <Link
              href={`/tasks/${activity.taskId}`}
              className="text-[10px] font-medium text-accent-orange hover:underline"
            >
              View task →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
