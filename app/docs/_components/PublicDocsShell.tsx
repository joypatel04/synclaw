"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpenText,
  ChevronRight,
  Cloud,
  Coins,
  FolderTree,
  HardDrive,
  HelpCircle,
  LifeBuoy,
  PlugZap,
  Server,
  Settings2,
  ShieldCheck,
  Webhook,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

type DocsNavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

const docsHeaderIcons = {
  AlertTriangle,
  BookOpenText,
  Cloud,
  Coins,
  FolderTree,
  HardDrive,
  HelpCircle,
  PlugZap,
  Server,
  Settings2,
  ShieldCheck,
  Webhook,
  Wrench,
} as const;

export type PublicDocsIconName = keyof typeof docsHeaderIcons;

const docsNavGroups: Array<{ title: string; items: DocsNavItem[] }> = [
  {
    title: "Start",
    items: [
      { href: "/docs", label: "Overview", icon: BookOpenText },
      { href: "/docs/public-wss", label: "Public WSS", icon: Cloud },
      { href: "/docs/self-hosted", label: "Self-hosted", icon: HardDrive },
      { href: "/docs/pricing", label: "Product Model", icon: Coins },
      { href: "/docs/faq", label: "FAQ", icon: HelpCircle },
    ],
  },
  {
    title: "Hosting Guides",
    items: [
      { href: "/docs/hosting", label: "Hosting Overview", icon: Server },
      { href: "/docs/hosting/cloud", label: "Public WSS Hosting", icon: Cloud },
      {
        href: "/docs/hosting/self-hosted",
        label: "Self-hosted Hosting",
        icon: HardDrive,
      },
      {
        href: "/docs/hosting/self-hosted/convex",
        label: "Configure Convex",
        icon: Server,
      },
      {
        href: "/docs/hosting/self-hosted/mcp",
        label: "Configure OpenClaw + MCP",
        icon: Wrench,
      },
      {
        href: "/docs/hosting/self-hosted/files-bridge",
        label: "OpenClaw Files Bridge",
        icon: FolderTree,
      },
      {
        href: "/docs/hosting/environment",
        label: "Environment Reference",
        icon: Settings2,
      },
      {
        href: "/docs/hosting/webhooks",
        label: "Webhook Automation",
        icon: Webhook,
      },
      {
        href: "/docs/hosting/webhooks/security",
        label: "Webhook Security",
        icon: ShieldCheck,
      },
      {
        href: "/docs/hosting/webhooks/providers",
        label: "Provider Recipes",
        icon: Webhook,
      },
      {
        href: "/docs/hosting/troubleshooting",
        label: "Troubleshooting",
        icon: LifeBuoy,
      },
    ],
  },
];

const docsTopNav: DocsNavItem[] = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/hosting", label: "Hosting" },
  { href: "/docs/public-wss", label: "Public WSS" },
  { href: "/docs/self-hosted", label: "Self-hosted" },
  { href: "/docs/pricing", label: "Model" },
  { href: "/docs/faq", label: "FAQ" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/docs") return pathname === "/docs";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicDocsShell({
  title,
  description,
  iconName,
  children,
}: {
  title: string;
  description: string;
  iconName: PublicDocsIconName;
  children: React.ReactNode;
}) {
  const Icon = docsHeaderIcons[iconName];
  const pathname = usePathname() ?? "/docs";
  const activeTopNav = docsTopNav.find((item) =>
    isActivePath(pathname, item.href),
  );

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-secondary/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/docs" className="flex items-center gap-2">
            <Image
              src="/brand/synclaw-logo.png"
              alt="SynClaw logo"
              width={20}
              height={20}
              className="h-5 w-5"
            />
            <span className="text-sm font-semibold">
              {brand.product.shortName} Docs
            </span>
          </Link>

          <div className="hidden min-w-0 flex-1 px-4 md:block">
            <div className="ml-auto flex max-w-md items-center rounded-lg border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-dim">
              Search docs...
              <span className="ml-auto rounded border border-border-default px-1.5 py-0.5 text-[10px]">
                Cmd+K
              </span>
            </div>
          </div>

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

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap gap-2 lg:hidden">
          {docsTopNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition",
                isActivePath(pathname, item.href)
                  ? "border-accent-orange/40 bg-accent-orange/10 text-accent-orange"
                  : "border-border-default bg-bg-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_220px]">
          <aside className="hidden lg:block">
            <div className="sticky top-[72px] rounded-xl border border-border-default bg-bg-secondary p-3">
              <nav className="space-y-5">
                {docsNavGroups.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                      {group.title}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition",
                              active
                                ? "border border-accent-orange/35 bg-accent-orange/10 text-accent-orange"
                                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                            )}
                          >
                            {ItemIcon ? (
                              <ItemIcon className="h-3.5 w-3.5" />
                            ) : null}
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-6 border-b border-border-default pb-4">
              <div className="mb-3 flex items-center gap-1.5 text-xs text-text-dim">
                <Link href="/docs" className="hover:text-text-secondary">
                  Docs
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{activeTopNav?.label ?? "Guide"}</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-orange/15">
                  <Icon className="h-5 w-5 text-accent-orange" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {title}
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5">{children}</div>
          </section>

          <aside className="hidden xl:block">
            <div className="sticky top-[72px] space-y-3">
              <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Need Help?
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  <Link
                    href="/docs/hosting/troubleshooting"
                    className="block rounded-md border border-border-default bg-bg-primary px-2.5 py-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  >
                    Troubleshooting guide
                  </Link>
                  <Link
                    href="/docs/faq"
                    className="block rounded-md border border-border-default bg-bg-primary px-2.5 py-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  >
                    Common questions
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Current Direction
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">
                  OSS beta focuses on Public WSS + BYO OpenClaw. Keep setup
                  aligned to this docs sidebar for current behavior.
                </p>
              </div>
            </div>
          </aside>
        </div>
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
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-text-secondary">
        {children}
      </div>
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
    <div className="overflow-hidden rounded-lg border border-border-default bg-bg-primary">
      {title ? (
        <div className="border-b border-border-default bg-bg-secondary px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
            {title}
          </p>
        </div>
      ) : null}
      <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-3 font-mono text-xs text-text-primary">
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
      <div className="mt-1 text-sm leading-relaxed text-text-secondary">
        {children}
      </div>
    </div>
  );
}
