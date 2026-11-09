import type { ReactNode } from "react";

/** Same look on every screen size: a centered form, with the wordmark top-left on desktop. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col md:px-12 md:pt-7">
      <p className="display hidden text-[22px] leading-7 tracking-[-0.015em] md:block">Diary.</p>
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5 pb-10 pt-6 md:justify-center md:px-0 md:pb-24 md:pt-0">
        {children}
      </main>
    </div>
  );
}
