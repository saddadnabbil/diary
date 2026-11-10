"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EntryRow } from "@/components/entry-row";
import { Page } from "@/components/page";
import { ModelBadge, SuggestionSkeleton } from "@/components/suggestions";
import { NextIcon, RefreshIcon } from "@/components/icons";
import { LinkButton } from "@/components/ui";
import { displayName, useEntries } from "@/hooks/use-entries";
import { useSettings } from "@/hooks/use-settings";
import { useSuggestions } from "@/hooks/use-suggestions";
import { currentStreak, formatLong, greeting } from "@/lib/dates";

export default function DashboardPage() {
  const settings = useSettings();
  const entries = useEntries();
  const { suggestions, loading, source, refresh } = useSuggestions(null, 1);
  const now = useMemo(() => new Date(), []);

  const name = settings?.displayName?.trim() || displayName(settings?.email);
  const stats = useMemo(() => {
    const list = entries ?? [];
    const thisMonth = list.filter((e) => {
      const d = new Date(e.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return { streak: currentStreak(list.map((e) => e.createdAt), now), thisMonth };
  }, [entries, now]);

  const prompt = suggestions[0];

  return (
    <Page>
      <p className="text-[14px] leading-5 text-fg-3">{formatLong(now)}</p>
      <h1 className="display mt-3 text-[28px] leading-8 md:text-[44px] md:leading-[48px]">
        {greeting(now.getHours())}
        {name ? `, ${name}.` : "."}
      </h1>

      <section aria-label="Stats" className="mt-6 grid grid-cols-2 gap-3 md:mt-10">
        <Stat value={stats.streak} label="day streak" />
        <Stat value={stats.thisMonth} label={stats.thisMonth === 1 ? "entry this month" : "entries this month"} />
      </section>

      <Link
        href="/story/new"
        className="mt-3 flex items-center justify-between rounded-[20px] border border-line px-5 py-4 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      >
        <span className="flex flex-col">
          <span className="text-[16px] leading-6 font-medium">Add a story</span>
          <span className="text-[13px] leading-[18px] text-fg-3">One photo and a short caption</span>
        </span>
        <NextIcon size={18} />
      </Link>

      <section aria-labelledby="prompt-h" className="mt-7">
        <div className="flex items-center justify-between">
          <h2 id="prompt-h" className="text-[14px] leading-5 font-medium">
            Today’s prompt
          </h2>
          <ModelBadge source={source} />
        </div>
        <div className="mt-3 rounded-[24px] border border-line p-5 md:p-7">
          {loading && !prompt ? (
            <SuggestionSkeleton />
          ) : prompt ? (
            <>
              <p className="text-[12px] leading-4 font-medium text-fg-3">{prompt.category}</p>
              <p className="display mt-2 text-[22px] leading-[30px] tracking-[-0.02em] md:text-[26px] md:leading-9">{prompt.text}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <LinkButton href={`/write?prompt=${encodeURIComponent(prompt.text)}`}>Write about this</LinkButton>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading}
                  aria-label="Shuffle prompt"
                  title="Shuffle prompt"
                  className="flex size-[42px] items-center justify-center rounded-full border border-line bg-bg text-fg-2 transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-50"
                >
                  <RefreshIcon size={18} className={loading ? "animate-spin" : undefined} />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="recent-h" className="mt-7">
        <div className="flex items-center justify-between">
          <h2 id="recent-h" className="text-[14px] leading-5 font-medium">
            Recent entries
          </h2>
          {(entries?.length ?? 0) > 0 && (
            <Link href="/entries" className="text-[14px] leading-5 text-fg-2 hover:text-fg">
              See all
            </Link>
          )}
        </div>
        {entries && entries.length === 0 ? (
          <p className="mt-4 rounded-[20px] bg-surface px-5 py-6 text-[15px] leading-6 text-fg-2">
            Nothing here yet. Your first entry is one prompt away.
          </p>
        ) : (
          <div className="mt-1">{entries?.slice(0, 3).map((e) => <EntryRow key={e.id} entry={e} />)}</div>
        )}
      </section>
    </Page>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[20px] border border-line px-[18px] py-4">
      <p className="text-[32px] leading-9 font-medium tracking-[-0.1em]">{value}</p>
      <p className="text-[13px] leading-[18px] text-fg-3">{label}</p>
    </div>
  );
}
