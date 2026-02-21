import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpenText } from "lucide-react";
import { brand } from "@/lib/brand";

const navItems = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/hosting", label: "Hosting" },
  { href: "/docs/cloud", label: "Cloud" },
  { href: "/docs/self-hosted", label: "Self-hosted" },
  { href: "/docs/pricing", label: "Pricing" },
  { href: "/docs/faq", label: "FAQ" },
] as const;

export function PublicDocsShell({
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
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-default bg-bg-secondary/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <BookOpenText className="h-4 w-4 text-accent-orange" />
            <span className="text-sm font-semibold">{brand.product.shortName} Docs</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-accent-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-orange/90"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-border-default bg-bg-secondary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mb-6 flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-orange/15">
            <Icon className="h-5 w-5 text-accent-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
            <p className="mt-1 text-sm text-text-muted">{description}</p>
          </div>
        </div>

        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

export function PublicDocsCard({
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

export function PublicDocsCodeBlock({
  title,
  code,
}: {
  title?: string;
  code: string;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-primary p-3">
      {title ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
          {title}
        </p>
      ) : null}
      <pre className="overflow-x-auto font-mono text-xs text-text-primary whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

export function PublicDocsCallout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-accent-orange/30 bg-accent-orange/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-orange">
        {title}
      </p>
      <div className="mt-1 text-sm text-text-secondary">{children}</div>
    </div>
  );
}
