"use client";

import { useEffect, useRef } from "react";
import { Button } from "./ui";

/** Centered confirmation modal. Esc or a click outside cancels. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc" className="w-full max-w-[380px] rounded-[24px] border border-line bg-bg p-6 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.4)]">
        <h2 id="confirm-title" className="text-[20px] font-medium leading-7 tracking-[-0.02em]">{title}</h2>
        <p id="confirm-desc" className="mt-2 text-[15px] leading-6 text-fg-2">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-full border border-line px-[18px] py-2.5 text-[14px] leading-5 text-fg-2 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg">
            Cancel
          </button>
          <Button onClick={onConfirm} disabled={busy}>{busy ? "Deleting…" : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
