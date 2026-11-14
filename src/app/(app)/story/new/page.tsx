"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { STORY_CAPTION_MAX } from "@/components/story-view";
import { cx } from "@/components/ui";
import { addImage, createEntry } from "@/lib/db";
import { ImageError, prepareImage } from "@/lib/images";

/** Like Instagram: up to ten photos shared at once, each one its own story. */
const MAX_DRAFTS = 10;

interface Draft {
  key: string;
  blob: Blob;
  url: string;
  caption: string;
}

/**
 * New stories, full screen: the camera opens straight away, the gallery button picks one or more
 * photos, and every photo gets its own caption before sharing. Nothing is saved until Share.
 */
export default function NewStoryPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"camera" | "compose">("camera");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gallery = useRef<HTMLInputElement>(null);
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  // Free every preview when the page closes.
  useEffect(() => () => draftsRef.current.forEach((d) => URL.revokeObjectURL(d.url)), []);

  // Notices fade on their own.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const add = useCallback(async (files: File[]) => {
    const room = MAX_DRAFTS - draftsRef.current.length;
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    if (images.length > room) setNotice(`Up to ${MAX_DRAFTS} photos at a time.`);
    setBusy(true);
    const added: Draft[] = [];
    for (const file of images.slice(0, Math.max(0, room))) {
      try {
        const blob = await prepareImage(file);
        added.push({ key: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), caption: "" });
      } catch (e) {
        setNotice(e instanceof ImageError ? e.message : "Could not add that photo.");
      }
    }
    setBusy(false);
    if (!added.length) return;
    setActive(draftsRef.current.length); // jump to the first new photo
    setDrafts((prev) => [...prev, ...added]);
    setMode("compose");
  }, []);

  function remove(i: number) {
    const d = drafts[i];
    if (!d) return;
    URL.revokeObjectURL(d.url);
    const next = drafts.filter((_, j) => j !== i);
    setDrafts(next);
    setActive(Math.max(0, Math.min(i, next.length - 1)));
    if (!next.length) setMode("camera");
  }

  function setCaption(value: string) {
    setDrafts((prev) => prev.map((d, j) => (j === active ? { ...d, caption: value.slice(0, STORY_CAPTION_MAX) } : d)));
  }

  async function share() {
    if (!drafts.length || busy) return;
    setBusy(true);
    try {
      const now = Date.now();
      let firstId: string | null = null;
      // Times follow the order the photos were picked, so they play in that order (earliest first).
      for (const [i, d] of drafts.entries()) {
        const mediaId = await addImage(d.blob);
        const at = now - (drafts.length - 1) + i;
        const entry = await createEntry({ kind: "story", mediaId, title: d.caption.trim(), body: "", createdAt: at, updatedAt: at });
        firstId ??= entry.id;
      }
      router.replace(firstId ? `/entries/${firstId}` : "/entries");
    } catch {
      setBusy(false);
      setNotice("Could not share. Try again.");
    }
  }

  function close() {
    if (mode === "camera" && drafts.length) return setMode("compose");
    if (drafts.length) return setDiscarding(true);
    leave();
  }
  function leave() {
    if (window.history.length > 1) router.back();
    else router.replace("/entries");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void add(Array.from(e.dataTransfer.files));
  }

  const draft = drafts[active];

  return (
    <div
      className="fixed inset-0 z-40 flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black text-white"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <div className="relative h-full w-full overflow-hidden md:my-4 md:h-[calc(100dvh-32px)] md:w-auto md:aspect-[9/16] md:rounded-[18px]">
        {mode === "camera" ? (
          <Camera
            onCapture={(file) => void add([file])}
            onGallery={() => gallery.current?.click()}
            onClose={close}
            onNext={drafts.length ? () => setMode("compose") : undefined}
            count={drafts.length}
            lastThumb={drafts[drafts.length - 1]?.url}
            busy={busy}
          />
        ) : draft ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.url} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.url} alt={`Photo ${active + 1} of ${drafts.length}`} className="relative size-full object-contain" />

            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent px-3 pb-10 pt-[max(12px,env(safe-area-inset-top))]">
              <RoundButton label="Close" onClick={close}>
                <CloseGlyph />
              </RoundButton>
              {drafts.length > 1 && (
                <span className="text-[13px] font-medium text-white/85">
                  {active + 1} / {drafts.length}
                </span>
              )}
              <RoundButton label="Remove this photo" onClick={() => remove(active)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
                </svg>
              </RoundButton>
            </div>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-20">
              <CaptionField key={draft.key} value={draft.caption} onChange={setCaption} />

              <div className="mt-4 flex items-center gap-3">
                <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
                  {drafts.map((d, i) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={`Photo ${i + 1}`}
                      aria-current={i === active}
                      className={cx(
                        "h-14 w-10 shrink-0 overflow-hidden rounded-[8px] border-2 transition-opacity",
                        i === active ? "border-white" : "border-transparent opacity-70 hover:opacity-100",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.url} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                  {drafts.length < MAX_DRAFTS && (
                    <button
                      type="button"
                      onClick={() => setMode("camera")}
                      aria-label="Add more photos"
                      className="flex h-14 w-10 shrink-0 items-center justify-center rounded-[8px] border border-white/40 text-white/90 hover:bg-white/10"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={share}
                  disabled={busy}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-white py-2.5 pl-4 pr-3 text-[14px] font-semibold text-black disabled:opacity-60"
                >
                  {busy ? "Sharing…" : drafts.length > 1 ? `Share ${drafts.length}` : "Share"}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : null}

        {dragging && (
          <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[16px] border-2 border-dashed border-white/70 bg-black/40 text-[15px] font-medium">
            Drop photos to add them
          </div>
        )}

        {notice && (
          <p role="status" className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-center text-[13px] leading-[18px] backdrop-blur">
            {notice}
          </p>
        )}
      </div>

      <input
        ref={gallery}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void add(files);
        }}
      />

      <ConfirmDialog
        open={discarding}
        title={drafts.length > 1 ? `Discard ${drafts.length} photos?` : "Discard this photo?"}
        description="They have not been shared yet. If you leave now, they will be gone."
        confirmLabel="Discard"
        onConfirm={leave}
        onCancel={() => setDiscarding(false)}
      />
    </div>
  );
}

/** The caption sits on the photo, like story text. The counter shows only while typing. */
function CaptionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="sr-only" htmlFor="story-caption">
        Caption
      </label>
      <textarea
        id="story-caption"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Add a caption…"
        maxLength={STORY_CAPTION_MAX}
        rows={2}
        className="block w-full resize-none bg-transparent text-[17px] leading-6 break-words text-white placeholder:text-white/65 focus:outline-none [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
      />
      {focused && (
        <p className="text-right text-[12px] leading-4 text-white/70" aria-live="polite">
          {value.length}/{STORY_CAPTION_MAX}
        </p>
      )}
    </div>
  );
}

/** Live camera filling the screen, with the shutter, the gallery and a flip button. */
function Camera({
  onCapture,
  onGallery,
  onClose,
  onNext,
  count,
  lastThumb,
  busy,
}: {
  onCapture: (file: File) => void;
  onGallery: () => void;
  onClose: () => void;
  onNext?: () => void;
  count: number;
  lastThumb?: string;
  busy: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [state, setState] = useState<"starting" | "live" | "off">("starting");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      queueMicrotask(() => setState("off"));
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => undefined);
        }
        setState("live");
      })
      .catch(() => !cancelled && setState("off"));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  function snap() {
    const el = video.current;
    if (!el || !el.videoWidth) return;
    // Keep what the screen shows: the cover-cropped 9:16 area, mirrored for the front camera.
    const target = el.clientWidth / el.clientHeight;
    let sw = el.videoWidth;
    let sh = el.videoHeight;
    if (sw / sh > target) sw = sh * target;
    else sh = sw / target;
    const sx = (el.videoWidth - sw) / 2;
    const sy = (el.videoHeight - sh) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(el, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    canvas.toBlob((blob) => blob && onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })), "image/jpeg", 0.92);
  }

  return (
    <div className="relative size-full bg-black">
      <video
        ref={video}
        playsInline
        muted
        aria-label="Camera preview"
        className={cx("absolute inset-0 size-full object-cover", facing === "user" && "-scale-x-100", state !== "live" && "opacity-0")}
      />
      {state === "off" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-[17px] font-medium">Camera is off</p>
          <p className="text-[14px] leading-5 text-white/70">Allow camera access to take a photo, or pick photos from your gallery.</p>
          <button type="button" onClick={onGallery} className="mt-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black">
            Choose from gallery
          </button>
        </div>
      )}
      {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/45 to-transparent px-3 pb-8 pt-[max(12px,env(safe-area-inset-top))]">
        <RoundButton label={count ? "Back to your photos" : "Close"} onClick={onClose}>
          <CloseGlyph />
        </RoundButton>
        <span className="text-[15px] font-semibold">New story</span>
        <span className="size-10" aria-hidden="true" />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/50 to-transparent px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-16">
        <button
          type="button"
          onClick={onGallery}
          disabled={busy}
          aria-label="Choose from gallery"
          className="flex size-11 items-center justify-center overflow-hidden rounded-[10px] border-2 border-white/90 bg-white/10 disabled:opacity-60"
        >
          {lastThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lastThumb} alt="" className="size-full object-cover" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
              <circle cx="9" cy="10" r="1.5" />
              <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={snap}
          disabled={state !== "live" || busy}
          aria-label="Take photo"
          className="flex size-[76px] items-center justify-center rounded-full border-[4px] border-white transition-transform active:scale-95 disabled:opacity-40"
        >
          <span className="size-[60px] rounded-full bg-white" />
        </button>

        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            aria-label={`Next, ${count} ${count === 1 ? "photo" : "photos"}`}
            className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-white px-3 text-[14px] font-semibold text-black"
          >
            {count}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ) : (
          <RoundButton label="Switch camera" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} disabled={state !== "live"}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 0 0-14.3-4.9M4 13a8 8 0 0 0 14.3 4.9" />
              <path d="M20 4v5h-5M4 20v-5h5" />
            </svg>
          </RoundButton>
        )}
      </div>
    </div>
  );
}

function RoundButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur hover:bg-black/40 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function CloseGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
