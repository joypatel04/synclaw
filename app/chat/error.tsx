"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl p-3 sm:p-6">
        <h1 className="text-lg sm:text-xl font-bold text-text-primary">
          Chat failed to load
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {error?.message || "Unknown error"}
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={reset}>Retry</Button>
        </div>
      </div>
    </AppLayout>
  );
}
