"use client";

import { useDefaultProvider } from "@/hooks/use-settings";
import type { SuggestionSource } from "@/hooks/use-suggestions";
import type { Suggestion } from "@/lib/types";
import { RefreshIcon } from "./icons";
import { Button, cx, StatusDot } from "./ui";

export function SuggestionCard({
  suggestion,
  onPick,
  className,
}: {
  suggestion: Suggestion;
  onPick?: (s: Suggestion) => void;
  className?: string;
}) {
  const body = (
    <>
      <span className="text-[12px] leading-4 font-medium tracking-normal text-fg-3">{suggestion.category}</span>
      <span className="text-[16px] leading-6 text-fg">{suggestion.text}</span>
    </>
  );
  const base = "flex w-full flex-col items-start gap-2.5 rounded-[20px] border border-line bg-bg p-5 text-left";
  if (!onPick) return <div className={cx(base, className)}>{body}</div>;
  return (
    <button
      type="button"
      onClick={() => onPick(suggestion)}
      className={cx(base, "transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg", className)}
    >
      {body}
    </button>
  );
}

export function SuggestionSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[92px] animate-pulse rounded-[20px] bg-surface" />
      ))}
    </div>
  );
}

/** Shows where the prompt came from. Green with the model name only when the model actually wrote it. */
export function ModelBadge({ source }: { source: SuggestionSource | null }) {
  const provider = useDefaultProvider();
  const fromModel = source === "ai";
  const label = fromModel ? (provider?.label ?? "AI model") : "Built-in";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[12px] leading-4 text-fg-2">
      <span className={cx("size-1.5 rounded-full", fromModel ? "bg-success" : "bg-fg-3")} aria-hidden="true" />
      {label}
    </span>
  );
}

export function ShuffleButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={loading} className="gap-2">
      <RefreshIcon size={16} className={cx(loading && "animate-spin")} />
      Shuffle
    </Button>
  );
}

export function SourceNote({ source, notice, mood }: { source: SuggestionSource | null; notice: string | null; mood: string | null }) {
  if (source === "fallback") {
    return <p className="text-[13px] leading-[18px] text-fg-3">{notice ? `${notice} Showing built-in prompts.` : "Showing built-in prompts."}</p>;
  }
  return (
    <p className="flex items-center gap-2 text-[13px] leading-[18px] text-fg-3">
      <StatusDot className="size-1.5" />
      {mood ? `Based on your mood: ${mood}` : "Pick a mood for tailored prompts"}
    </p>
  );
}
