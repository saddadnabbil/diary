"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

/**
 * Live camera preview for desktop browsers. A file input with capture= only opens the
 * file picker there, so this asks for the webcam directly and grabs one frame.
 */
export function WebcamCapture({ onCapture, onCancel }: { onCapture: (file: File) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => undefined);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Camera is not available. Allow camera access, or choose a photo instead.");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap() {
    const el = video.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext("2d")?.drawImage(el, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not take that photo. Try again.");
          return;
        }
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  if (error) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4 px-6 text-center text-[14px] text-fg-2">
        <p>{error}</p>
        <Button variant="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex size-full flex-col items-center justify-end gap-3 bg-black p-4">
      <video
        ref={video}
        playsInline
        muted
        className="absolute inset-0 size-full object-cover"
        aria-label="Camera preview"
      />
      <div className="relative z-10 flex w-full max-w-[220px] flex-col gap-2">
        <Button variant="primary" onClick={snap} disabled={!ready} className="w-full">
          Capture
        </Button>
        <Button variant="secondary" onClick={onCancel} className="w-full">
          Cancel
        </Button>
      </div>
    </div>
  );
}
