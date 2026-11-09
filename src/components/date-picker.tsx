"use client";

import { useEffect, useRef, useState } from "react";
import { formatLong, formatMonthYear, isSameDay, monthGrid } from "@/lib/dates";
import { BackIcon, NextIcon } from "./icons";
import { cx } from "./ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Date trigger plus a calendar popover that matches the app (the native picker does not). */
export function DatePicker({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  const [open, setOpen] = useState(false);
  const selected = new Date(value);
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const root = useRef<HTMLDivElement>(null);
  const [today] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const move = (d: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + d, 1));
  const atCurrentMonth = cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();

  function pick(day: Date) {
    const next = new Date(value); // keep the time of day, change only the day
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(Math.min(next.getTime(), today.getTime()));
    setOpen(false);
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
          setOpen((v) => !v);
        }}
        aria-label={`Entry date: ${formatLong(value)}. Change date`}
        className="-ml-2 flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] leading-[18px] text-fg-3 transition-colors hover:bg-surface-hover hover:text-fg md:text-[14px] md:leading-5"
      >
        {formatLong(value)}
        <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a date" className="absolute left-0 top-full z-30 mt-2 w-[296px] rounded-[20px] border border-line bg-bg p-4 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium leading-6" aria-live="polite">{formatMonthYear(cursor)}</p>
            <div className="flex items-center text-fg-2">
              <button type="button" aria-label="Previous month" onClick={() => move(-1)} className="rounded-full p-1.5 hover:bg-surface-hover hover:text-fg">
                <BackIcon size={18} />
              </button>
              <button type="button" aria-label="Next month" disabled={atCurrentMonth} onClick={() => move(1)} className="rounded-full p-1.5 hover:bg-surface-hover hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent">
                <NextIcon size={18} />
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-medium leading-4 text-fg-3">
            {WEEKDAYS.map((d, i) => <span key={i} className="pb-1">{d}</span>)}
          </div>
          {monthGrid(cursor.getFullYear(), cursor.getMonth()).map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                if (!day) return <span key={di} />;
                const future = day > today && !isSameDay(day, today);
                const isSel = isSameDay(day, selected);
                return (
                  <button
                    key={di}
                    type="button"
                    disabled={future}
                    onClick={() => pick(day)}
                    aria-label={formatLong(day)}
                    aria-pressed={isSel}
                    className={cx(
                      "mx-auto my-0.5 flex size-9 items-center justify-center rounded-full text-[14px] leading-5 transition-colors",
                      isSel ? "bg-primary font-medium text-on-primary" : "hover:bg-surface-hover",
                      !isSel && isSameDay(day, today) && "border border-fg",
                      future && "text-fg-3 opacity-40 hover:bg-transparent",
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => pick(today)} className="rounded-full px-3 py-1.5 text-[13px] font-medium hover:bg-surface-hover">
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
