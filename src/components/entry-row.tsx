import Link from "next/link";
import { Fragment } from "react";
import { dayKey, formatShort } from "@/lib/dates";
import { imageIds, plainText } from "@/lib/rich";
import { MediaStrip } from "./media-strip";
import { LIST_PHOTO_HEIGHT, StoryGroup } from "./story-view";
import type { Entry } from "@/lib/types";

export function entryPreview(e: Entry, max = 160): string {
  const flat = plainText(e.body).replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() + "…" : flat;
}

/** Entries in order, with stories of the same day next to each other folded into one row of photos. */
export function EntryList({ entries }: { entries: Entry[] }) {
  const runs: Entry[][] = [];
  for (const e of entries) {
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1];
    if (e.kind === "story" && prev?.kind === "story" && dayKey(new Date(prev.createdAt)) === dayKey(new Date(e.createdAt))) last.push(e);
    else runs.push([e]);
  }
  return (
    <>
      {runs.map((run) => (
        <Fragment key={run[0].id}>{run[0].kind === "story" ? <StoryGroup stories={run} /> : <EntryRow entry={run[0]} />}</Fragment>
      ))}
    </>
  );
}

export function EntryRow({ entry }: { entry: Entry }) {
  if (entry.kind === "story") return <StoryGroup stories={[entry]} />;
  const photos = imageIds(entry.body);
  return (
    <Link
      href={`/entries/${entry.id}`}
      className="group flex flex-col gap-1.5 border-b border-line py-5 md:flex-row md:gap-8 md:py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
    >
      <span className="text-[13px] leading-[18px] text-fg-3 md:w-[72px] md:shrink-0 md:pt-1 md:text-[14px] md:leading-6">
        {formatShort(entry.createdAt)}
        {/* Mood sits with the date (beside it on phones, under it on desktop) so every row's content has the same width. */}
        {entry.mood && (
          <>
            <span className="md:hidden">{`  ·  ${entry.mood}`}</span>
            <span className="hidden truncate text-[13px] leading-[18px] md:mt-1 md:block">{entry.mood}</span>
          </>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[18px] leading-[26px] font-medium tracking-[-0.015em] md:text-[20px] md:leading-7 group-hover:underline underline-offset-4 decoration-line">
          {entry.title.trim() || "Untitled"}
        </span>
        <span className="line-clamp-2 text-[15px] leading-6 text-fg-2">{entryPreview(entry)}</span>
        {photos.length > 0 && <MediaStrip className="mt-2" height={LIST_PHOTO_HEIGHT} items={photos.map((mediaId) => ({ mediaId }))} />}
      </div>
    </Link>
  );
}
