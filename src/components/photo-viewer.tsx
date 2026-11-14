"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useImageUrl } from "@/components/rich/extensions";
import { fetchRemoteImage } from "@/lib/sync";
import { BackIcon, NextIcon } from "./icons";
import { cx } from "./ui";

export interface Slide {
  id: string;
  mediaId: string | null;
  /** Slides with the same group share the progress bar (stories of one day). */
  group?: string;
}

const STORY_MS = 6000;
const CLOSE_DRAG = 110;

/**
 * Full-screen photo viewer, like Instagram stories: one photo per screen, swipe or tap the sides
 * to move, hold to pause, swipe down to close. Desktop shows a tall card with arrows.
 */
export function PhotoViewer({
  slides,
  index,
  onIndex,
  onClose,
  autoAdvance = false,
  paused: pausedOutside = false,
  header,
  footer,
  label = "Photos",
  card = false,
}: {
  slides: Slide[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  autoAdvance?: boolean;
  /** Stop the timer while something on top (editing, a dialog) needs attention. */
  paused?: boolean;
  header?: (slide: Slide, i: number) => ReactNode;
  footer?: (slide: Slide, i: number) => ReactNode;
  label?: string;
  /** Desktop: show a tall 9:16 card (stories) instead of using the whole screen. */
  card?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [holding, setHolding] = useState(false);
  const drag = useRef<{ x: number; y: number; dy: number; vertical: boolean | null } | null>(null);
  const indexRef = useRef(index);
  useLayoutEffect(() => {
    indexRef.current = index;
  }, [index]);
  // Reduced motion shortens every animation to nothing, which would race through the stories.
  // Only rendered on the client (after data loads or a tap), so window is there.
  const [calm] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const timed = autoAdvance && !calm;

  const go = useCallback(
    (i: number, smooth = true) => {
      const el = track.current;
      if (!el || i < 0 || i >= slides.length) return;
      el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "instant" });
      onIndex(i);
    },
    [slides.length, onIndex],
  );

  // Start on the requested slide, and stay on it when the window is resized.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: indexRef.current * el.clientWidth, behavior: "instant" });
    const ro = new ResizeObserver(() => el.scrollTo({ left: indexRef.current * el.clientWidth, behavior: "instant" }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A swipe ends on a snapped slide: report it.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const settle = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== indexRef.current) onIndex(i);
    };
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(settle, 120); // scrollend is not everywhere yet
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, [onIndex]);

  // Keyboard, and no page scroll underneath.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("textarea, input")) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(indexRef.current + 1);
      else if (e.key === "ArrowLeft") go(indexRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [go, onClose]);

  const slide = slides[index];
  const group = slide ? slides.map((s, i) => [s, i] as const).filter(([s]) => (s.group ?? "") === (slide.group ?? "")) : [];
  const paused = holding || pausedOutside;

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, textarea, input, a")) return;
    drag.current = { x: e.clientX, y: e.clientY, dy: 0, vertical: null };
    setHolding(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.vertical === null && Math.hypot(dx, dy) > 8) d.vertical = Math.abs(dy) > Math.abs(dx);
    if (d.vertical && dy > 0) {
      d.dy = dy;
      if (root.current) {
        root.current.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy, 400) / 2000})`;
        root.current.style.opacity = String(1 - Math.min(dy, 400) / 800);
      }
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    setHolding(false);
    if (!d) return;
    const el = root.current;
    if (d.vertical && d.dy > CLOSE_DRAG) return onClose();
    if (el) {
      el.style.transition = "transform 200ms ease, opacity 200ms ease";
      el.style.transform = "";
      el.style.opacity = "";
      setTimeout(() => el && (el.style.transition = ""), 220);
    }
    // A short tap (no drag): left third goes back, the rest goes forward.
    if (d.vertical === null && e.type === "pointerup") {
      const box = track.current?.getBoundingClientRect();
      if (!box || e.clientX < box.left || e.clientX > box.right) return;
      if (e.clientX - box.left < box.width * 0.3) go(index - 1);
      else go(index + 1);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-40 h-[100dvh] w-screen select-none overflow-hidden bg-black text-white"
    >
      <div ref={root} className="flex size-full items-center justify-center">
        {slides.length > 1 && (
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous"
            className="mr-6 hidden size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 disabled:invisible md:flex"
          >
            <BackIcon size={20} />
          </button>
        )}

        <div
          className={cx("relative h-full w-full", card ? "md:my-4 md:h-[calc(100dvh-32px)] md:w-auto md:aspect-[9/16] md:overflow-hidden md:rounded-[18px]" : "md:max-w-[1100px]")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div ref={track} className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto overscroll-contain [touch-action:pan-x]">
            {slides.map((s, i) => (
              <div key={s.id} className="relative h-full w-full shrink-0 snap-center snap-always overflow-hidden" aria-hidden={i !== index}>
                {Math.abs(i - index) <= 2 ? <FullPhoto mediaId={s.mediaId} /> : null}
              </div>
            ))}
          </div>

          {/* Top: progress, then the slide's own header. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-3 pb-10 pt-[max(10px,env(safe-area-inset-top))]">
            {group.length > 0 && (
              <div className="flex gap-1">
                {group.map(([s, i]) => (
                  <span key={s.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/35">
                    {i < index ? (
                      <span className="block h-full w-full bg-white" />
                    ) : i === index ? (
                      <span
                        key={`${s.id}-${index}`}
                        className={cx("block h-full bg-white", timed ? "story-progress" : "w-full")}
                        style={timed ? { animationDuration: `${STORY_MS}ms`, animationPlayState: paused ? "paused" : "running" } : undefined}
                        onAnimationEnd={() => {
                          if (index < slides.length - 1) go(index + 1);
                        }}
                      />
                    ) : null}
                  </span>
                ))}
              </div>
            )}
            <div className="pointer-events-auto mt-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">{slide && header?.(slide, index)}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>

          {slide && footer && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-16">
              {footer(slide, index)}
            </div>
          )}
        </div>

        {slides.length > 1 && (
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === slides.length - 1}
            aria-label="Next"
            className="ml-6 hidden size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 disabled:invisible md:flex"
          >
            <NextIcon size={20} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The photo, fitted whole, over a blurred copy of itself so the edges are never plain black. */
function FullPhoto({ mediaId }: { mediaId: string | null }) {
  const url = useImageUrl(mediaId);
  useEffect(() => {
    if (url === null && mediaId) void fetchRemoteImage(mediaId);
  }, [url, mediaId]);
  if (!url) {
    return <div className="flex size-full items-center justify-center text-[13px] text-white/60">{url === undefined ? "Loading…" : "Loading from cloud…"}</div>;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" draggable={false} className="relative size-full object-contain" />
    </>
  );
}
