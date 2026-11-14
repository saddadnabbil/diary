/** The moods everyone starts with. People can add their own next to these. */
export const PRESET_MOODS = ["Calm", "Happy", "Tired", "Anxious", "Grateful"] as const;

export const MAX_MOOD_LENGTH = 24;

/**
 * Tidy what someone typed as a mood: single spaces, no control characters, capped length.
 * Returns null when nothing is left.
 */
export function cleanMood(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_MOOD_LENGTH).trim();
  return text || null;
}

/** A typed mood that matches a known one ignoring case ("calm" -> "Calm") reuses it instead of making a twin. */
export function matchMood(input: string, known: readonly string[]): string | null {
  const text = cleanMood(input);
  if (!text) return null;
  return known.find((k) => k.toLowerCase() === text.toLowerCase()) ?? text;
}

/** Presets first, then the custom moods in use, most used first. */
export function moodOptions(used: readonly (string | null | undefined)[], extra: readonly string[] = []): string[] {
  const counts = new Map<string, number>();
  for (const m of used) if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  const preset = new Set<string>(PRESET_MOODS);
  const custom = [...counts.entries()].filter(([m]) => !preset.has(m)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m);
  const out: string[] = [...PRESET_MOODS, ...custom];
  for (const m of extra) if (!out.some((o) => o.toLowerCase() === m.toLowerCase())) out.push(m);
  return out;
}
