import type { ReactNode } from "react";
import { AppGate, Sidebar } from "@/components/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate>
      <div className="flex min-h-screen flex-1 flex-col md:flex-row">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </AppGate>
  );
}
