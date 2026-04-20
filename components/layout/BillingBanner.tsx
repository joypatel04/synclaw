"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const DISMISS_KEY = "synclaw:setup-call-banner-dismissed";

export function BillingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between border-b border-border-hover bg-bg-hover px-4 py-2 text-xs text-text-secondary">
      <span>
        Want a guided setup?{" "}
        <Link
          href="#"
          className="font-semibold underline underline-offset-2 hover:text-text-secondary/80"
        >
          Book a setup call
        </Link>{" "}
        — we'll get you running in under an hour.
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="ml-4 shrink-0 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
