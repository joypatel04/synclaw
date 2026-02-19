"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";

function RedirectSetupPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  useEffect(() => {
    if (!id) return;
    router.replace(`/chat/${id}?setup=1`);
  }, [id, router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
    </div>
  );
}

export default function AgentSetupPage() {
  return (
    <AppLayout>
      <RedirectSetupPage />
    </AppLayout>
  );
}
