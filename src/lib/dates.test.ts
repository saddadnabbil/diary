import { describe, expect, it } from "vitest";
import { currentStreak, dayKey, greeting, monthGrid, timeOfDay, wordCount } from "./dates";

describe("monthGrid", () => {
  it("lays out November 2026 (starts on a Sunday) in 5 weeks", () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]?.getDate()).toBe(1);
    expect(weeks[4].filter(Boolean).map((d) => d!.getDate())).toEqual([29, 30]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("pads leading blanks when the month does not start on Sunday", () => {
    const weeks = monthGrid(2026, 11); // 1 Dec 2026 is a Tuesday
    expect(weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(weeks[0][2]?.getDate()).toBe(1);
  });
});

describe("currentStreak", () => {
  const now = new Date(2026, 10, 8, 10);
  const at = (day: number) => new Date(2026, 10, day, 9).getTime();

  it("counts consecutive days ending today", () => {
    expect(currentStreak([at(8), at(7), at(6), at(4)], now)).toBe(3);
  });
  it("stays alive when today is not written yet", () => {
    expect(currentStreak([at(7), at(6)], now)).toBe(2);
  });
  it("is zero after a missed day", () => {
    expect(currentStreak([at(5)], now)).toBe(0);
  });
  it("counts several entries on one day once", () => {
    expect(currentStreak([at(8), at(8), at(7)], now)).toBe(2);
  });
});

describe("helpers", () => {
  it("dayKey pads", () => expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05"));
  it("timeOfDay buckets", () => {
    expect(timeOfDay(6)).toBe("morning");
    expect(timeOfDay(13)).toBe("afternoon");
    expect(timeOfDay(19)).toBe("evening");
    expect(timeOfDay(2)).toBe("night");
  });
  it("greeting", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(15)).toBe("Good afternoon");
    expect(greeting(23)).toBe("Good evening");
  });
  it("wordCount", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(wordCount("   ")).toBe(0);
  });
});
