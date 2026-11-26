"use client";

import Image from "next/image";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { Page } from "@/components/page";
import { Button, Chip, PageTitle } from "@/components/ui";
import type { DemoArchive } from "@/lib/server/instagram-archive";

const filters = [
  { id: "all", label: "All memories" },
  { id: "post", label: "Posts" },
  { id: "story", label: "Stories" },
  { id: "reel", label: "Reels" },
  { id: "comment", label: "Comments" },
] as const;
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Jakarta" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const labels = { post: "Post", story: "Story", reel: "Reel" };
type Memory = DemoArchive["memories"][number];

function DateLabel({ timestamp }: { timestamp: number | null }) {
  return timestamp === null
    ? <span>Date unavailable</span>
    : <time dateTime={new Date(timestamp).toISOString()}>{dateFormat.format(timestamp)}</time>;
}

function MemoryCard({ memory }: { memory: Memory }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const photo = memory.media[index];
  return (
    <article className="overflow-hidden rounded-[20px] border border-line bg-bg">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {photo.src && !failed.includes(photo.uri) ? (
          <Image
            key={photo.uri}
            src={photo.src}
            alt={photo.alt}
            fill
            unoptimized
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            onError={() => setFailed((previous) => [...previous, photo.uri])}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-fg-2">
            {memory.kind === "reel" ? "Video file missing from the sample export." : "Photo unavailable."}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="text-[13px] text-fg-2">
          {labels[memory.kind]} <span aria-hidden="true">·</span> <DateLabel timestamp={memory.createdAt} />
        </p>
        <h3 className="text-[17px] leading-6 font-medium">{memory.caption || "Untitled " + labels[memory.kind].toLowerCase()}</h3>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {photo.credit && (
            <a href={photo.credit} target="_blank" rel="noreferrer" className="text-xs text-fg-2 underline underline-offset-2">
              Photo on Unsplash
            </a>
          )}
          {memory.media.length > 1 && (
            <div className="flex items-center gap-1 text-xs text-fg-2" aria-label="Carousel controls">
              <Button type="button" variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous photo">‹</Button>
              <span aria-live="polite">{index + 1} / {memory.media.length}</span>
              <Button type="button" variant="ghost" disabled={index === memory.media.length - 1} onClick={() => setIndex(index + 1)} aria-label="Next photo">›</Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function InstagramArchive({ archive }: { archive: DemoArchive }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  function matches(text: string, date: number | null) {
    const formatted = date === null ? "" : dateFormat.format(date);
    const haystack = (text + " " + formatted).toLowerCase();
    return terms.every((term) => haystack.includes(term));
  }

  const months = new Map<string, Memory[]>();
  for (const memory of archive.memories) {
    if ((filter !== "all" && filter !== memory.kind) || !matches(memory.caption, memory.createdAt)) continue;
    const month = memory.createdAt === null ? "Undated" : monthFormat.format(memory.createdAt);
    const group = months.get(month) ?? [];
    group.push(memory);
    months.set(month, group);
  }
  const comments = filter === "comment"
    ? archive.comments.filter((comment) => matches(comment.text + " " + (comment.mediaOwner ?? ""), comment.createdAt))
    : [];

  return (
    <Page wide>
      <PageTitle sub="A sample Instagram export with posts, stories, reels and comments.">Instagram archive.</PageTitle>

      <div className="mt-8 flex flex-col gap-4">
        <label className="flex items-center gap-2.5 rounded-full border border-line bg-bg px-4 py-2.5 text-fg-2 focus-within:border-fg sm:max-w-sm">
          <SearchIcon size={18} />
          <span className="sr-only">Search archive</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search text or date"
            className="w-full bg-transparent text-[15px] text-fg placeholder:text-fg-3 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter archive">
          {filters.map(({ id, label }) => (
            <Chip key={id} selected={filter === id} onClick={() => setFilter(id)}>{label}</Chip>
          ))}
        </div>
      </div>

      {months.size === 0 && comments.length === 0 && <p role="status" className="mt-8 text-fg-2">Nothing matches your search.</p>}
      {[...months].map(([month, memories]) => (
        <section key={month} aria-label={month} className="mt-8">
          <h2 className="mb-3 text-[15px] font-medium text-fg-2">{month}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}
          </div>
        </section>
      ))}
      {comments.length > 0 && (
        <section aria-label="Comments you wrote" className="mt-8">
          <h2 className="mb-3 text-[15px] font-medium text-fg-2">Comments you wrote</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line">
            {comments.map((comment) => (
              <li key={comment.id} className="p-4">
                <p>{comment.text}</p>
                <p className="mt-1 text-[13px] text-fg-2">
                  {comment.mediaOwner && <span>@{comment.mediaOwner} · </span>}
                  <DateLabel timestamp={comment.createdAt} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
