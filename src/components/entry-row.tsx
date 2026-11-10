import Link from "next/link";
import { formatShort } from "@/lib/dates";
import { plainText } from "@/lib/rich";
import { StoryRow } from "./story-view";
import type { Entry } from "@/lib/types";

export function entryPreview(e: Entry, max = 160): string {
  const flat = plainText(e.body).replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() + "…" : flat;
}

export function EntryRow({ entry }: { entry: Entry }) {
  if (entry.kind === "story") return <StoryRow entry={entry} />;
  return (
    <Link
      href={`/entries/${entry.id}`}
      className="group flex flex-col gap-1.5 border-b border-line py-5 md:flex-row md:gap-8 md:py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
    >
      <span className="text-[13px] leading-[18px] text-fg-3 md:w-[72px] md:shrink-0 md:pt-1 md:text-[14px] md:leading-6">
        {formatShort(entry.createdAt)}
        <span className="md:hidden">{entry.mood ? `  ·  ${entry.mood}` : ""}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[18px] leading-[26px] font-medium tracking-[-0.015em] md:text-[20px] md:leading-7 group-hover:underline underline-offset-4 decoration-line">
          {entry.title.trim() || "Untitled"}
        </span>
        <span className="line-clamp-2 text-[15px] leading-6 text-fg-2">{entryPreview(entry)}</span>
      </span>
      {entry.mood && <span className="hidden text-[13px] leading-[18px] text-fg-3 md:block md:pt-1.5">{entry.mood}</span>}
    </Link>
  );
}
