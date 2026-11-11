"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { BackIcon } from "@/components/icons";
import { Page } from "@/components/page";
import { STORY_CAPTION_MAX } from "@/components/story-view";
import { Button, cx } from "@/components/ui";
import { createEntry, saveEntry } from "@/lib/db";
import { ImageError, storeImage } from "@/lib/images";
import { WebcamCapture } from "@/components/webcam-capture";

/** A story: one photo with a short caption. No body text. The entry is created once the photo is in. */
export default function NewStoryPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [webcam, setWebcam] = useState(false);

  // Phones open the native camera through the file input. Desktop gets a live webcam preview,
  // because a file input with capture only opens the file picker there.
  function takePhoto() {
    const desktop = !window.matchMedia("(pointer: coarse)").matches;
    if (desktop && typeof navigator.mediaDevices?.getUserMedia === "function") setWebcam(true);
    else camera.current?.click();
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Free the preview URL when it is replaced or the page closes.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const mediaId = await storeImage(file);
      const now = Date.now();
      if (storyId) {
        await saveEntry(storyId, { mediaId });
      } else {
        const entry = await createEntry({ kind: "story", mediaId, title: caption, body: "", createdAt: now, updatedAt: now });
        setStoryId(entry.id);
      }
      const url = URL.createObjectURL(file);
      setPreview(url); // the effect above frees the previous preview
    } catch (e) {
      setError(e instanceof ImageError ? e.message : "Could not add that photo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function onCaption(value: string) {
    const next = value.slice(0, STORY_CAPTION_MAX);
    setCaption(next);
    if (!storyId) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveEntry(storyId, { title: next }), 400);
  }

  async function done() {
    clearTimeout(timer.current);
    if (storyId) await saveEntry(storyId, { title: caption });
    router.push(storyId ? `/entries/${storyId}` : "/entries");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    void pick(file);
  }

  return (
    <Page>
      <div className="flex items-center justify-between">
        <Link href="/entries" aria-label="Back to entries" className="-ml-1 rounded-full p-1 text-fg hover:bg-surface-hover">
          <BackIcon />
        </Link>
        <Button variant="primary" onClick={done} disabled={busy || !storyId} className="!py-2">
          Done
        </Button>
      </div>

      <h1 className="display mt-8 text-[28px] leading-8 md:text-[36px] md:leading-[44px]">New story.</h1>
      <p className="mt-2 text-[15px] leading-6 text-fg-2">One photo and a short caption. That is all.</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          "relative mx-auto mt-8 flex aspect-[9/16] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-[24px] border bg-surface",
          dragging ? "border-fg" : "border-line",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : webcam ? (
          <WebcamCapture
            onCapture={(file) => {
              setWebcam(false);
              void pick(file);
            }}
            onCancel={() => setWebcam(false)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center text-[15px] text-fg-2">
            <button
              type="button"
              onClick={takePhoto}
              disabled={busy}
              className="w-full max-w-[220px] rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-on-primary disabled:opacity-60"
            >
              {busy ? "Adding…" : "Take a photo"}
            </button>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="w-full max-w-[220px] rounded-full border border-line bg-bg px-5 py-2.5 text-[14px] font-medium text-fg-2 hover:text-fg disabled:opacity-60"
            >
              Choose from gallery
            </button>
            <span className="text-[13px] text-fg-3">or drop one here</span>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {/* capture opens the camera on phones; on desktop it falls back to the file picker. */}
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>

      {preview && (
        <div className="mx-auto mt-4 flex max-w-[320px] justify-center">
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
            Change photo
          </Button>
        </div>
      )}

      <label className="sr-only" htmlFor="story-caption">
        Caption
      </label>
      <textarea
        id="story-caption"
        value={caption}
        onChange={(e) => onCaption(e.target.value)}
        placeholder="Add a caption"
        maxLength={STORY_CAPTION_MAX}
        rows={2}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        className="mx-auto mt-6 block w-full max-w-[320px] resize-none bg-transparent text-center text-[17px] leading-6 break-words placeholder:text-fg-3 focus:outline-none"
      />
      {editing && (
        <p className="mt-1 text-center text-[12px] leading-4 text-fg-3" aria-live="polite">
          {caption.length}/{STORY_CAPTION_MAX}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-6 text-center text-[13px] leading-[18px] text-fg">
          {error}
        </p>
      )}
    </Page>
  );
}
