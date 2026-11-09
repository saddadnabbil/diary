import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/app-shell";

/** Pages that show the bottom tab bar on mobile. */
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MobileTabBar />
    </>
  );
}
