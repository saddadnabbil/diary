import type { Mood, Suggestion } from "./types";

interface Prompt extends Suggestion {
  /** When set, the prompt is preferred for these moods. */
  moods?: Mood[];
}

/** Offline fallback used when no model is reachable. */
export const PROMPTS: Prompt[] = [
  { category: "Gratitude", text: "What small moment today made you quietly glad?" },
  { category: "Gratitude", text: "Who helped you recently, and what would you like to tell them?", moods: ["Grateful", "Happy"] },
  { category: "Gratitude", text: "Which three ordinary things are you thankful for right now?" },
  { category: "Gratitude", text: "What did your body carry you through today?" },
  { category: "Reflection", text: "What has been weighing on you, and what would setting it down feel like?", moods: ["Tired", "Anxious"] },
  { category: "Reflection", text: "What did this week teach you about yourself?" },
  { category: "Reflection", text: "Which moment from today would you live again, and which would you skip?" },
  { category: "Reflection", text: "What is taking more of your energy than it deserves?", moods: ["Tired", "Anxious"] },
  { category: "Reflection", text: "What would you tell yourself from a year ago?" },
  { category: "Memory", text: "Which moment from this week do you want to remember a year from now?" },
  { category: "Memory", text: "Describe a place that felt like home, even for a short while." },
  { category: "Memory", text: "What is your earliest memory of a day like today?", moods: ["Calm"] },
  { category: "Memory", text: "Which song takes you straight back to a certain time? Where does it take you?" },
  { category: "Goals", text: "What is one small thing you want to finish before this week ends?" },
  { category: "Goals", text: "If you knew it would work out, what would you start tomorrow?", moods: ["Happy", "Calm"] },
  { category: "Goals", text: "What would make tomorrow feel like a good day?" },
  { category: "Goals", text: "Which of your plans is really someone else's expectation?" },
  { category: "Calm", text: "Describe the quietest part of your day in detail.", moods: ["Calm"] },
  { category: "Calm", text: "What does a slow, unhurried morning look like for you?", moods: ["Calm"] },
  { category: "Calm", text: "Where do you feel tension in your body right now, and what is it about?", moods: ["Anxious", "Tired"] },
  { category: "Calm", text: "Write down what is worrying you, then one thing you can actually do about it.", moods: ["Anxious"] },
  { category: "Joy", text: "What made you laugh lately?", moods: ["Happy"] },
  { category: "Joy", text: "What are you looking forward to, even if it is small?", moods: ["Happy", "Grateful"] },
  { category: "Joy", text: "Describe a meal or a drink you really enjoyed this week.", moods: ["Happy", "Calm"] },
  { category: "Creativity", text: "Write the opening line of a story about the next person you meet." },
  { category: "Creativity", text: "Describe your day as if it were a weather forecast." },
  { category: "Creativity", text: "If today had a title, what would it be?" },
  { category: "Rest", text: "What would real rest look like for you this weekend?", moods: ["Tired"] },
  { category: "Rest", text: "What could you say no to this week to protect your energy?", moods: ["Tired", "Anxious"] },
  { category: "Connection", text: "Who have you been meaning to reach out to?" },
  { category: "Connection", text: "Write a letter to someone, one you may never send." },
];

/**
 * Pick `count` prompts, preferring ones that match the mood and were not shown
 * recently. `rng` is injectable so the function is deterministic in tests.
 */
export function pickPrompts(opts: {
  mood: Mood | null;
  count?: number;
  exclude?: string[];
  rng?: () => number;
}): Suggestion[] {
  const { mood, count = 3, exclude = [], rng = Math.random } = opts;
  const excluded = new Set(exclude);
  const fresh = PROMPTS.filter((p) => !excluded.has(p.text));
  const pool = fresh.length >= count ? fresh : PROMPTS;

  const matching = mood ? pool.filter((p) => p.moods?.includes(mood)) : [];
  const rest = pool.filter((p) => !matching.includes(p));

  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // At most 2 mood-matched prompts so the set stays varied; one category each.
  const ordered = [...shuffle(matching).slice(0, 2), ...shuffle(rest), ...shuffle(matching).slice(2)];
  const picked: Prompt[] = [];
  const usedCategories = new Set<string>();
  for (const p of ordered) {
    if (picked.length === count) break;
    if (usedCategories.has(p.category)) continue;
    usedCategories.add(p.category);
    picked.push(p);
  }
  for (const p of ordered) {
    if (picked.length === count) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked.map(({ category, text }) => ({ category, text }));
}
