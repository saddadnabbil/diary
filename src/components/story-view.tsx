"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MediaStrip } from "@/components/media-strip";
import { PhotoViewer, type Slide } from "@/components/photo-viewer";
import { useEntries } from "@/hooks/use-entries";
import { deleteEntry, saveEntry } from "@/lib/db";
import { dayKey, formatLong, formatShort, formatTime } from "@/lib/dates";
import type { Entry } from "@/lib/types";

export const STORY_CAPTION_MAX = 120;
/** Photos in the entries list share one height, stories and entries alike. */
export const LIST_PHOTO_HEIGHT = 200;

/* Set when a story is opened from inside the app, so closing can go back to where it was. */
let openedFromApp = false;

/** Stories of one day in the entries list: their photos in one row, each opens the full-screen viewer. */
export function StoryGroup({ stories: newestFirst }: { stories: Entry[] }) {
  const router = useRouter();
  // Like Instagram: a day's stories play from the earliest.
  const stories = [...newestFirst].reverse();
  const first = stories[0];
  return (
    // Same columns as an entry row (date left, content right) so the list reads as one.
    <div className="flex flex-col gap-1.5 border-b border-line py-5 md:flex-row md:gap-8 md:py-6">
      <span className="text-[13px] leading-[18px] text-fg-3 md:w-[72px] md:shrink-0 md:pt-1 md:text-[14px] md:leading-6">
        {formatShort(first.createdAt)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[18px] leading-[26px] font-medium tracking-[-0.015em] md:text-[20px] md:leading-7">
          {stories.length === 1 ? "Story" : `${stories.length} stories`}
        </span>
        <MediaStrip
          className="mt-2"
          height={LIST_PHOTO_HEIGHT}
        items={stories.map((s) => ({ mediaId: s.mediaId ?? null, label: s.title.trim() || undefined }))}
        onOpen={(i) => {
          openedFromApp = true;
          router.push(`/entries/${stories[i].id}`);
        }}
        />
      </div>
    </div>
  );
}

/** Days newest first (like the entries list), and within a day the earliest story first (like Instagram). */
function storyOrder(newestFirst: Entry[]): Entry[] {
  const days: Entry[][] = [];
  for (const s of newestFirst) {
    const last = days[days.length - 1];
    if (last && dayKey(new Date(last[0].createdAt)) === dayKey(new Date(s.createdAt))) last.push(s);
    else days.push([s]);
  }
  return days.flatMap((d) => d.reverse());
}

/**
 * Every story, full screen, starting at the one that was tapped. Stories of the same day share
 * the progress bar and play from the earliest; after a day's last story comes the day before.
 */
export function StoryViewer({ startId }: { startId: string }) {
  const router = useRouter();
  const entries = useEntries();
  const stories = useMemo(() => storyOrder((entries ?? []).filter((e) => e.kind === "story")), [entries]);
  const [current, setCurrent] = useState(startId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const index = Math.max(0, stories.findIndex((s) => s.id === current));
  const slides: Slide[] = useMemo(() => stories.map((s) => ({ id: s.id, mediaId: s.mediaId ?? null, group: dayKey(new Date(s.createdAt)) })), [stories]);

  const onIndex = useCallback(
    (i: number) => {
      const s = stories[i];
      if (!s) return;
      setCurrent(s.id);
      setEditing(false);
      // Keep the address on the story being shown, without a navigation.
      window.history.replaceState(window.history.state, "", `/entries/${s.id}`);
    },
    [stories],
  );

  const close = useCallback(() => {
    if (openedFromApp) {
      openedFromApp = false;
      router.back();
    } else router.replace("/entries");
  }, [router]);

  async function remove() {
    const s = stories[index];
    if (!s) return;
    setDeleting(true);
    const next = stories[index + 1] ?? stories[index - 1];
    // Move to the neighbour first: the list shrinks by one, so the scroll position already shows it.
    if (next) {
      setCurrent(next.id);
      window.history.replaceState(window.history.state, "", `/entries/${next.id}`);
    }
    await deleteEntry(s.id);
    setDeleting(false);
    setConfirming(false);
    if (!next) close();
  }

  if (!entries) return <div className="fixed inset-0 z-40 bg-black" aria-busy="true" />;
  if (!stories.length) return null;

  return (
    <>
      <PhotoViewer
        label="Stories"
        slides={slides}
        index={index}
        onIndex={onIndex}
        onClose={close}
        autoAdvance
        card
        paused={editing || confirming}
        header={(_, i) => {
          const s = stories[i];
          return (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium text-white/90">
                {formatLong(s.createdAt)} <span className="text-white/60">· {formatTime(s.createdAt)}</span>
              </p>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label="Delete this story"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
                </svg>
              </button>
            </div>
          );
        }}
        footer={(_, i) => <Caption key={stories[i].id} entry={stories[i]} editing={editing} setEditing={setEditing} />}
      />
      <ConfirmDialog
        open={confirming}
        title="Delete this story?"
        description="The photo and caption will be removed from this device and, if sync is on, from your other devices."
        confirmLabel="Delete story"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

/** The caption over the bottom of the photo. Tap to edit; saved shortly after typing stops. */
function Caption({ entry, editing, setEditing }: { entry: Entry; editing: boolean; setEditing: (v: boolean) => void }) {
  const [caption, setCaption] = useState(entry.title);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (caption === entry.title) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveEntry(entry.id, { title: caption }), 500);
    return () => clearTimeout(timer.current);
  }, [caption, entry.id, entry.title]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full text-left text-[16px] leading-[22px] break-words text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]"
      >
        {caption.trim() || <span className="text-white/60">Add a caption</span>}
      </button>
    );
  }
  return (
    <div>
      <label className="sr-only" htmlFor="story-caption-edit">
        Caption
      </label>
      <textarea
        id="story-caption-edit"
        autoFocus
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, STORY_CAPTION_MAX))}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="Add a caption"
        maxLength={STORY_CAPTION_MAX}
        rows={2}
        className="block w-full resize-none rounded-xl bg-black/35 px-3 py-2 text-[16px] leading-[22px] text-white placeholder:text-white/60 focus:outline-none"
      />
      <p className="mt-1 text-right text-[12px] leading-4 text-white/70" aria-live="polite">
        {caption.length}/{STORY_CAPTION_MAX}
      </p>
    </div>
  );
}
