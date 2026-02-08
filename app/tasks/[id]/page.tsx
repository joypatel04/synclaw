"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { TaskDetail } from "@/components/task/TaskDetail";
import type { Id } from "@/convex/_generated/dataModel";
import { use } from "react";

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AppLayout><TaskDetail taskId={id as Id<"tasks">} /></AppLayout>;
}
