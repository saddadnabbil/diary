"use client";

import { useState, type FormEvent } from "react";
import { musicUri, parseMusicLink, providerName } from "@/lib/music";

const STEPS = [
  "Open the song in Spotify, YouTube Music or YouTube.",
  "Tap Share (or the ⋯ menu), then Copy link.",
  "Paste it below and press Add.",
];

/**
 * Paste a song link from Spotify, YouTube Music or YouTube. `onPick` receives the validated uri,
 * and the editor inserts the embed.
 */
export function MusicPicker({ onPick, onClose }: { onPick: (uri: string) => void; onClose: () => void }) {
  const [value, setValue] = useState("");
  const ref = parseMusicLink(value);
  const tried = value.trim().length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (ref) onPick(musicUri(ref));
  }

  return (
    <div className="mt-3 rounded-[20px] border border-line bg-bg p-4 shadow-sm" role="dialog" aria-label="Add music">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] leading-5 font-medium">Add a song</p>
        <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-[13px] text-fg-2 hover:text-fg">
          Close
        </button>
      </div>

      <ol className="mt-3 flex flex-col gap-1.5 text-[13px] leading-5 text-fg-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-2">
            <span className="text-fg-3">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12px] leading-4 text-fg-3">Works with Spotify, YouTube Music and YouTube links.</p>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <label htmlFor="music-link" className="sr-only">
          Paste a song link
        </label>
        <input
          id="music-link"
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a link here"
          autoFocus
          autoComplete="off"
          aria-invalid={tried && !ref}
          aria-describedby={tried && !ref ? "music-link-error" : undefined}
          className="min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2 text-[14px] leading-5 placeholder:text-fg-3 focus:border-fg focus:outline-none"
        />
        <button
          type="submit"
          disabled={!ref}
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-[14px] leading-5 font-medium text-on-primary disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {tried && !ref && (
        <p id="music-link-error" role="alert" className="mt-2 text-[13px] leading-5 text-fg-2">
          That link is not from Spotify, YouTube Music or YouTube. Copy the song’s link and try again.
        </p>
      )}
      {ref && <p className="mt-2 text-[13px] leading-5 text-fg-3">Found a {providerName(ref.provider)} {ref.kind}. Press Add.</p>}
    </div>
  );
}
