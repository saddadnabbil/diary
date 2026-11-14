import { describe, expect, it } from "vitest";
import { cleanMood, matchMood, moodOptions, PRESET_MOODS } from "./moods";

describe("cleanMood", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(cleanMood("  so   excited ")).toBe("so excited");
    expect(cleanMood("x".repeat(80))).toHaveLength(24);
  });
  it("drops control characters and empty input", () => {
    expect(cleanMood("a\nb\u0000c")).toBe("a b c");
    expect(cleanMood("   ")).toBeNull();
    expect(cleanMood(42)).toBeNull();
  });
});

describe("matchMood", () => {
  it("reuses a known mood ignoring case", () => {
    expect(matchMood("calm", PRESET_MOODS)).toBe("Calm");
    expect(matchMood("Hopeful", PRESET_MOODS)).toBe("Hopeful");
  });
});

describe("moodOptions", () => {
  it("lists presets, then custom moods by use, then extras", () => {
    const used = ["Hopeful", "Calm", "Hopeful", "Bored", null, "Bored", "Bored"];
    expect(moodOptions(used, ["New", "bored"])).toEqual([...PRESET_MOODS, "Bored", "Hopeful", "New"]);
  });
});
