import Image from "next/image";
import Link from "next/link";
import { GlowButton } from "./GlowButton";

const LOGO_SRC = "/brand/synclaw-logo-20260329.png";

export function LandingNav({
  links,
  ctaLabel,
}: {
  links: Array<{ label: string; href: string }>;
  ctaLabel: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06080F]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={LOGO_SRC}
            alt="SynClaw logo"
            width={48}
            height={48}
            className="h-[48px] w-[48px]"
          />
          <span className="font-semibold tracking-tight text-white/90">
            SynClaw
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/55 transition-colors duration-200 hover:text-white/90"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <GlowButton
          href="/login"
          label={ctaLabel}
          className="px-4 py-2 text-sm"
        />
      </div>
    </header>
  );
}
