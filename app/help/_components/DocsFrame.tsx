import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

export function DocsFrame({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl p-3 sm:p-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-hover glow-orange">
              <Icon className="h-5 w-5 text-text-secondary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-text-primary sm:text-xl">
                {title}
              </h1>
              <p className="mt-1 text-xs text-text-muted">{description}</p>
            </div>
          </div>
          <Link
            href="/help/getting-started"
            className="rounded-lg border border-border-default bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Docs home
          </Link>
        </div>
        {children}
      </div>
    </AppLayout>
  );
}

export function DocsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <div className="mt-3 text-sm text-text-secondary">{children}</div>
    </section>
  );
}
