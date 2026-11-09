import type { ReactNode } from "react";
import { cx } from "./ui";

/** Centered content column used by every app page. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <main className={cx("mx-auto w-full flex-1 px-6 pb-16 pt-10 md:pt-16", wide ? "max-w-[1120px]" : "max-w-[720px]", className)}>
      {children}
    </main>
  );
}
