"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { BackIcon } from "@/components/icons";
import { Button, cx } from "@/components/ui";
import { adoptUser, hasCloudData } from "@/lib/account";
import { requestCode, verifyCode } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { updateSettings } from "@/lib/db";

const RESEND_SECONDS = 30;

function VerifyForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const res = await verifyCode(email, code);
    if (!res.ok) {
      setBusy(false);
      return setError(res.message ?? "That code did not work.");
    }
    const { data } = await authClient.getSession();
    if (!data) {
      setBusy(false);
      return setError("Could not start your session. Try again.");
    }
    await adoptUser({ id: data.user.id, email: data.user.email });
    // Returning user on a new device: their diary is already in the cloud, so skip setup.
    if (await hasCloudData()) {
      await updateSettings({ storageMode: "cloud", onboarded: true, syncCursor: 0 });
      router.push("/dashboard");
      return;
    }
    router.push("/onboarding/storage");
  }

  async function resend() {
    setWait(RESEND_SECONDS);
    setCode("");
    setError(null);
    await requestCode(email);
    input.current?.focus();
  }

  return (
    <>
      <Link href="/sign-in" aria-label="Back" className="-ml-1 w-fit p-1 text-fg">
        <BackIcon />
      </Link>
      <h1 className="display mt-10 text-[32px] leading-9">Check your email.</h1>
      <p className="mt-3 text-[17px] leading-[26px] text-fg-2">
        We sent a 6-digit code to <span className="break-all text-fg">{email || "your email"}</span>.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-6">
        <div className="relative">
          <label htmlFor="code" className="sr-only">
            6-digit code
          </label>
          {/* One real input handles typing, paste and autofill; the boxes just mirror it. */}
          <input
            ref={input}
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            aria-invalid={!!error}
            className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
          />
          <div className="flex gap-2" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={cx(
                  "flex h-[60px] flex-1 items-center justify-center rounded-[14px] bg-bg text-[24px] font-medium",
                  i === code.length ? "border-[1.5px] border-fg" : "border border-line",
                )}
              >
                {code[i] ?? ""}
              </div>
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="-mt-3 text-[13px] leading-[18px] text-fg">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
          {busy ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <div className="mt-auto pt-10 md:mt-0 md:pt-8 text-center text-[15px] leading-[22px] text-fg-3">
        {wait > 0 ? (
          `Resend code in 0:${String(wait).padStart(2, "0")}`
        ) : (
          <button type="button" onClick={resend} className="text-fg underline underline-offset-4">
            Resend code
          </button>
        )}
      </div>
    </>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
