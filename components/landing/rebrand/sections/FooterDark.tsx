import Link from "next/link";
import type { BrandConfig } from "@/lib/brand";
import { SectionFrame } from "../SectionFrame";

export function FooterDark({ brand }: { brand: BrandConfig }) {
  return (
    <footer className="border-t border-white/10 py-9">
      <SectionFrame>
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-white/45 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {brand.product.name}
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/privacy"
              className="transition-colors hover:text-white/80"
            >
              Privacy
            </Link>
            <Link
              href="/docs"
              className="transition-colors hover:text-white/80"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="transition-colors hover:text-white/80"
            >
              Continue
            </Link>
          </div>
        </div>
      </SectionFrame>
    </footer>
  );
}
