"use client";

import { useMemo, useState } from "react";
import { EntryRow } from "@/components/entry-row";
import { BackIcon, NextIcon } from "@/components/icons";
import { Page } from "@/components/page";
import { cx, LinkButton } from "@/components/ui";
import { useEntries } from "@/hooks/use-entries";
import { dayKey, formatLong, formatMonthYear, isSameDay, monthGrid } from "@/lib/dates";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarPage() {
  const entries = useEntries();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const byDay = useMemo(() => {
    const map = new Map<string, NonNullable<typeof entries>>();
    for (const e of entries ?? []) {
      const k = dayKey(new Date(e.createdAt));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [entries]);

  const weeks = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const dayEntries = byDay.get(dayKey(selected)) ?? [];
  const move = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  return (
    <Page>
      <div className="flex items-center justify-between">
        <h1 className="display text-[24px] leading-8 md:text-[36px] md:leading-10" aria-live="polite">
          {formatMonthYear(cursor)}
        </h1>
        <div className="flex items-center gap-1 text-fg-2">
          <button type="button" aria-label="Previous month" onClick={() => move(-1)} className="rounded-full p-2 hover:bg-surface-hover hover:text-fg">
            <BackIcon size={22} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => move(1)} className="rounded-full p-2 hover:bg-surface-hover hover:text-fg">
            <NextIcon size={22} />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={formatMonthYear(cursor)} className="mt-6">
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((d, i) => (
            <div key={i} role="columnheader" className="pb-2 text-center text-[12px] leading-4 font-medium text-fg-3">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7">
            {week.map((day, di) => {
              if (!day) return <div key={di} role="gridcell" />;
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selected);
              const future = day > today && !isToday;
              const count = byDay.get(dayKey(day))?.length ?? 0;
              return (
                <div key={di} role="gridcell" className="flex justify-center py-0.5">
                  <button
                    type="button"
                    onClick={() => setSelected(day)}
                    aria-label={`${formatLong(day)}${count ? `, ${count} ${count === 1 ? "entry" : "entries"}` : ""}`}
                    aria-pressed={isSelected}
                    className="group flex h-[50px] w-12 flex-col items-center gap-0.5 focus-visible:outline-none"
                  >
                    <span
                      className={cx(
                        "flex size-10 items-center justify-center rounded-full text-[15px] leading-5 transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-fg",
                        isToday && "bg-primary text-on-primary font-medium",
                        !isToday && isSelected && "border border-fg",
                        !isToday && !isSelected && "group-hover:bg-surface-hover",
                        future && !isSelected && "text-fg-3",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <span className={cx("size-1 rounded-full", count ? "bg-fg" : "bg-transparent")} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <section aria-labelledby="day-h" className="mt-5">
        <div className="flex items-center justify-between">
          <h2 id="day-h" className="text-[14px] leading-5 font-medium">
            {formatLong(selected)}
          </h2>
          <span className="text-[13px] leading-[18px] text-fg-3">
            {dayEntries.length === 1 ? "1 entry" : `${dayEntries.length} entries`}
          </span>
        </div>
        {dayEntries.length === 0 ? (
          <div className="mt-4 flex flex-col items-start gap-3 rounded-[20px] bg-surface px-5 py-6">
            <p className="text-[15px] leading-6 text-fg-2">
              {selected > today && !isSameDay(selected, today) ? "That day has not happened yet." : "No entry on this day."}
            </p>
            {selected <= today || isSameDay(selected, today) ? (
              <LinkButton href={`/write?date=${dayKey(selected)}`} variant="secondary">
                Write something
              </LinkButton>
            ) : null}
          </div>
        ) : (
          <div className="mt-1">
            {dayEntries.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
