"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { BackIcon } from "@/components/icons";
import { Button, Field } from "@/components/ui";
import { isEmail, requestCode } from "@/lib/auth";

function SignInForm() {
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1";
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) return setError("Enter a valid email address.");
    setError(null);
    setBusy(true);
    const res = await requestCode(email.trim());
    setBusy(false);
    if (!res.ok) return setError(res.message ?? "Could not send the code. Try again.");
    router.push(`/verify?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <>
      <Link href="/welcome" aria-label="Back" className="-ml-1 w-fit p-1 text-fg">
        <BackIcon />
      </Link>
      <h1 className="display mt-10 text-[32px] leading-9">{isNew ? "Create account." : "Sign in."}</h1>
      <p className="mt-3 text-[17px] leading-[26px] text-fg-2">
        Enter your email and we will send you a code. No password needed.
      </p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "email-error" : undefined}
        />
        {error && (
          <p id="email-error" role="alert" className="-mt-2 text-[13px] leading-[18px] text-fg">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Sending…" : "Continue"}
        </Button>
      </form>
      <p className="mt-auto pt-10 md:mt-0 md:pt-8 text-center text-[15px] leading-[22px] text-fg-2">
        {isNew ? (
          <>
            Already have an account? <Link href="/sign-in" className="text-fg underline underline-offset-4">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/sign-in?new=1" className="text-fg underline underline-offset-4">Create an account</Link>
          </>
        )}
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
