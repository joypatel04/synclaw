"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { BroadcastThread } from "@/components/broadcast/BroadcastThread";
import type { Id } from "@/convex/_generated/dataModel";
import { use } from "react";

export default function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AppLayout><BroadcastThread broadcastId={id as Id<"broadcasts">} /></AppLayout>;
}
