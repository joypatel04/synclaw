import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function GlowButton({
  href,
  label,
  variant = "primary",
  className,
  newTab = false,
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
  className?: string;
  newTab?: boolean;
}) {
  const target = newTab ? "_blank" : undefined;
  const rel = newTab ? "noopener noreferrer" : undefined;

  if (variant === "secondary") {
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5",
          className,
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={cn(
        "landing-cta-glow inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5",
        className,
      )}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
