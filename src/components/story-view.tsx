"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BackIcon } from "@/components/icons";
import { useImageUrl } from "@/components/rich/extensions";
import { Button, LinkButton } from "@/components/ui";
import { deleteEntry, saveEntry } from "@/lib/db";
import { formatLong, formatTime } from "@/lib/dates";
import { fetchRemoteImage } from "@/lib/sync";
import type { Entry } from "@/lib/types";

export const STORY_CAPTION_MAX = 120;

/** The photo of a story. Fetched from the cloud when this device does not have it yet. */
export function StoryImage({ mediaId, className }: { mediaId: string | null; className?: string }) {
  const url = useImageUrl(mediaId);
  useEffect(() => {
    if (url === null && mediaId) void fetchRemoteImage(mediaId);
  }, [url, mediaId]);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={className} />;
  }
  return <div className={`flex items-center justify-center bg-surface text-[13px] text-fg-3 ${className ?? ""}`}>{url === undefined ? "Loading…" : "Loading from cloud…"}</div>;
}

/** Story row in the entries list: small square photo and the caption. */
export function StoryRow({ entry }: { entry: Entry }) {
  return (
    <Link
      href={`/entries/${entry.id}`}
      className="group flex items-center gap-4 border-b border-line py-4 md:gap-6 md:py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
    >
      <StoryImage mediaId={entry.mediaId ?? null} className="size-16 shrink-0 rounded-[12px] border border-line object-cover md:size-20" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] leading-[18px] text-fg-3">Story · {formatLong(entry.createdAt)}</span>
        <span className="truncate text-[17px] leading-6 font-medium tracking-[-0.01em] group-hover:underline underline-offset-4 decoration-line md:text-[18px]">
          {entry.title.trim() || "No caption"}
        </span>
      </span>
    </Link>
  );
}

/** Full view of a story: the photo, a small editable caption, delete. */
export function StoryDetail({ entry }: { entry: Entry }) {
  const router = useRouter();
  const [caption, setCaption] = useState(entry.title);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Caption edits are saved shortly after typing stops.
  useEffect(() => {
    if (caption === entry.title) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveEntry(entry.id, { title: caption }), 500);
    return () => clearTimeout(timer.current);
  }, [caption, entry.id, entry.title]);

  async function remove() {
    setDeleting(true);
    await deleteEntry(entry.id);
    router.replace("/entries");
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <Link href="/entries" aria-label="Back to entries" className="-ml-1 rounded-full p-1 text-fg hover:bg-surface-hover">
          <BackIcon />
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      </div>

      <p className="mt-8 text-[13px] leading-[18px] text-fg-3 md:text-[14px] md:leading-5">
        Story · {formatLong(entry.createdAt)} · {formatTime(entry.createdAt)}
      </p>

      <div className="mt-5 flex justify-center">
        <StoryImage mediaId={entry.mediaId ?? null} className="max-h-[70vh] w-full max-w-[480px] rounded-[20px] border border-line object-contain" />
      </div>

      <label className="sr-only" htmlFor="caption">
        Caption
      </label>
      <input
        id="caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, STORY_CAPTION_MAX))}
        placeholder="Add a caption"
        maxLength={STORY_CAPTION_MAX}
        autoComplete="off"
        className="mx-auto mt-5 block w-full max-w-[480px] bg-transparent text-center text-[17px] leading-6 placeholder:text-fg-3 focus:outline-none"
      />
      <p className="mt-1 text-center text-[12px] leading-4 text-fg-3">
        {caption.length}/{STORY_CAPTION_MAX}
      </p>

      <div className="mt-8 flex justify-center">
        <LinkButton href="/dashboard" variant="secondary">
          Done
        </LinkButton>
      </div>

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
