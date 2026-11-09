import { describe, expect, it } from "vitest";
import { PROMPTS, pickPrompts } from "./prompts";

/** Small deterministic PRNG so shuffles are reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("pickPrompts", () => {
  it("returns the requested number of distinct prompts", () => {
    const out = pickPrompts({ mood: null, rng: seeded(1) });
    expect(out).toHaveLength(3);
    expect(new Set(out.map((p) => p.text)).size).toBe(3);
  });

  it("uses a different category for each prompt", () => {
    const out = pickPrompts({ mood: "Calm", rng: seeded(2) });
    expect(new Set(out.map((p) => p.category)).size).toBe(3);
  });

  it("prefers mood-matched prompts", () => {
    const tiredTexts = new Set(PROMPTS.filter((p) => p.moods?.includes("Tired")).map((p) => p.text));
    for (let s = 0; s < 20; s++) {
      const out = pickPrompts({ mood: "Tired", rng: seeded(s) });
      expect(out.some((p) => tiredTexts.has(p.text))).toBe(true);
    }
  });

  it("does not repeat excluded prompts when enough remain", () => {
    const first = pickPrompts({ mood: "Happy", rng: seeded(3) });
    const next = pickPrompts({ mood: "Happy", exclude: first.map((p) => p.text), rng: seeded(4) });
    const firstTexts = new Set(first.map((p) => p.text));
    expect(next.every((p) => !firstTexts.has(p.text))).toBe(true);
  });

  it("falls back to the full pool when everything is excluded", () => {
    const out = pickPrompts({ mood: null, exclude: PROMPTS.map((p) => p.text), rng: seeded(5) });
    expect(out).toHaveLength(3);
  });
});
