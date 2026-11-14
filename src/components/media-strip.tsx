"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useImageUrl } from "@/components/rich/extensions";
import { fetchRemoteImage } from "@/lib/sync";
import { cx } from "./ui";

/** Ratios outside this range are cropped, so one panorama or very tall shot cannot flatten or stretch the row. */
const MIN_RATIO = 0.75;
const MAX_RATIO = 1.91;
const GAP = 8;

export interface StripItem {
  mediaId: string | null;
  /** Small text shown over the bottom of the photo. */
  label?: ReactNode;
}

/**
 * Photos in one row, like X's multi-photo posts: every photo keeps its own shape at a shared height.
 * The first photo decides that height (capped by maxHeight); the rest scroll sideways.
 */
export function MediaStrip({
  items,
  maxHeight = 420,
  minHeight = 140,
  onOpen,
  onRemove,
  height: fixedHeight,
  fill = false,
  className,
  rounded = "rounded-[16px]",
}: {
  items: StripItem[];
  maxHeight?: number;
  minHeight?: number;
  onOpen?: (index: number) => void;
  /** Shows a remove button on each photo (editing). */
  onRemove?: (index: number) => void;
  /** Lists: one height for every row so they line up; only the widths follow each photo's shape. */
  height?: number;
  /**
   * Never leave the row half empty: when the photos are narrower than the row, they widen to fill it
   * and each shows whole on a blurred copy of itself.
   */
  fill?: boolean;
  className?: string;
  rounded?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [ratios, setRatios] = useState<Record<number, number>>({});

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const multi = items.length > 1;
  // With several photos, size against most of the width so the next one peeks in.
  const room = multi ? width * 0.82 : width;
  const clamp = (r: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
  const first = clamp(ratios[0] ?? 1);
  const height = fixedHeight ?? (width ? Math.round(Math.max(minHeight, Math.min(maxHeight, room / first))) : minHeight);
  const natural = items.map((_, i) => Math.min(width || Infinity, height * clamp(ratios[i] ?? 1)));
  const used = natural.reduce((a, b) => a + b, 0) + GAP * (items.length - 1);
  // Stretch every photo by the same factor so their sizes stay in proportion.
  const grow = fill && width && used < width ? (width - GAP * (items.length - 1)) / (used - GAP * (items.length - 1)) : 1;
  const widthOf = (i: number) => Math.round(natural[i] * grow);

  return (
    <div
      ref={box}
      className={cx("no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain", className)}
      style={{ gap: GAP, height }}
    >
      {items.map((item, i) => (
        <StripPhoto
          key={`${item.mediaId}-${i}`}
          item={item}
          width={widthOf(i)}
          height={height}
          padded={grow > 1}
          rounded={rounded}
          onRatio={(r) => setRatios((prev) => (prev[i] === r ? prev : { ...prev, [i]: r }))}
          onOpen={onOpen ? () => onOpen(i) : undefined}
          onRemove={onRemove ? () => onRemove(i) : undefined}
          label={`Photo ${i + 1} of ${items.length}`}
        />
      ))}
    </div>
  );
}

function StripPhoto({
  item,
  width,
  height,
  padded,
  rounded,
  onRatio,
  onOpen,
  onRemove,
  label,
}: {
  item: StripItem;
  width: number;
  height: number;
  /** Wider than the photo: show it whole over a blurred, cropped copy instead of cropping it. */
  padded: boolean;
  rounded: string;
  onRatio: (r: number) => void;
  onOpen?: () => void;
  onRemove?: () => void;
  label: string;
}) {
  const url = useImageUrl(item.mediaId);
  useEffect(() => {
    if (url === null && item.mediaId) void fetchRemoteImage(item.mediaId);
  }, [url, item.mediaId]);

  const inner = (
    <>
      {url && padded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full scale-110 object-cover opacity-70 blur-xl" />
      )}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h) onRatio(w / h);
          }}
          className={cx("relative size-full", padded ? "object-contain" : "object-cover")}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-[13px] text-fg-3">{url === undefined ? "Loading…" : "Loading from cloud…"}</span>
      )}
      {item.label && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2.5 pt-8 text-left text-[13px] leading-[18px] text-white">
          {item.label}
        </span>
      )}
    </>
  );

  const cls = cx("relative block shrink-0 snap-start overflow-hidden border border-line bg-surface", rounded);
  const style = { width: Number.isFinite(width) ? width : undefined, height };
  if (!onOpen) {
    return (
      <div className={cls} style={style}>
        {inner}
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove photo (${label.toLowerCase()})`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRemove}
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
      className={cx(cls, "cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg")}
      style={style}
    >
      {inner}
    </button>
  );
}
