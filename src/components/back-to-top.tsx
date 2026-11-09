"use client";

import { useEffect, useState } from "react";
import { cx } from "./ui";

/** Appears once the page is scrolled down; one tap returns to the top. */
export function BackToTop({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      aria-label="Back to top"
      className={cx(
        "fixed right-4 z-30 flex items-center gap-1.5 rounded-full border border-line bg-bg/95 px-4 py-2.5 text-[13px] font-medium leading-[18px] text-fg shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] backdrop-blur transition-colors hover:bg-surface-hover",
        className ?? "bottom-5",
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      Top
    </button>
  );
}
