"use client";

import { useMemo, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { EntryRow } from "@/components/entry-row";
import { SearchIcon } from "@/components/icons";
import { Page } from "@/components/page";
import { Chip, LinkButton, PageTitle } from "@/components/ui";
import { useEntries } from "@/hooks/use-entries";
import { dayKey, formatLong, formatMonthYear, formatShort } from "@/lib/dates";
import { plainText } from "@/lib/rich";
import { MOODS, type Entry, type Mood } from "@/lib/types";

export default function EntriesPage() {
  const entries = useEntries();
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);

  // Everything a person might type to find an entry: text, mood and the date in several forms
  // ("9 Nov", "monday 9 november", "november 2026", "2026-11-09").
  const index = useMemo(
    () =>
      new Map(
        (entries ?? []).map((e) => {
          const d = new Date(e.createdAt);
          const haystack = [e.title, plainText(e.body), e.mood ?? "", formatShort(d), formatLong(d), formatMonthYear(d), dayKey(d)].join("\n").toLowerCase();
          return [e.id, haystack] as const;
        }),
      ),
    [entries],
  );

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (entries ?? []).filter((e) => (!mood || e.mood === mood) && terms.every((t) => index.get(e.id)?.includes(t)));
  }, [entries, index, query, mood]);

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filtered) {
      const k = formatMonthYear(e.createdAt);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [filtered]);

  const total = entries?.length ?? 0;

  return (
    <Page>
      <PageTitle sub={total ? `${total} ${total === 1 ? "entry" : "entries"} so far.` : undefined}>Your entries.</PageTitle>

      <div className="mt-6 flex flex-col gap-4 md:mt-10">
        <label className="flex items-center gap-2.5 rounded-full border border-line bg-bg px-4 py-2.5 text-fg-3 focus-within:border-fg md:max-w-sm">
          <SearchIcon size={18} />
          <span className="sr-only">Search entries</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text or date"
            className="w-full bg-transparent text-[15px] leading-5 text-fg placeholder:text-fg-3 focus:outline-none"
          />
        </label>
        <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:px-0" role="group" aria-label="Filter by mood">
          <Chip selected={mood === null} onClick={() => setMood(null)}>
            All
          </Chip>
          {MOODS.map((m) => (
            <Chip key={m} selected={mood === m} onClick={() => setMood(mood === m ? null : m)}>
              {m}
            </Chip>
          ))}
        </div>
      </div>

      {entries && total === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-3 rounded-[20px] bg-surface px-5 py-6">
          <p className="text-[15px] leading-6 text-fg-2">No entries yet. Start with a prompt or a blank page.</p>
          <LinkButton href="/write">Write your first entry</LinkButton>
        </div>
      ) : entries && filtered.length === 0 ? (
        <p className="mt-10 text-[15px] leading-6 text-fg-2">Nothing matches your search.</p>
      ) : (
        groups.map(([month, list]) => (
          <section key={month} className="mt-8" aria-label={month}>
            <h2 className="text-[13px] leading-[18px] font-medium text-fg-3">{month}</h2>
            <div className="mt-1">
              {list.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </div>
          </section>
        ))
      )}
      <BackToTop className="bottom-24 md:bottom-5" />
    </Page>
  );
}
