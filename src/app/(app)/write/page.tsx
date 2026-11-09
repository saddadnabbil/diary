"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Editor } from "@/components/editor";

/** "?date=2026-11-08" starts the entry on that day (keeping the current time of day). Future or invalid dates are ignored. */
function startOfEntry(date: string | null): number | undefined {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const [y, m, d] = date.split("-").map(Number);
  const now = new Date();
  const at = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
  return Number.isNaN(at.getTime()) || at.getTime() > now.getTime() ? undefined : at.getTime();
}

function NewEntry() {
  const params = useSearchParams();
  return <Editor initialPrompt={params.get("prompt") ?? undefined} initialDate={startOfEntry(params.get("date"))} />;
}

export default function WritePage() {
  return (
    <Suspense>
      <NewEntry />
    </Suspense>
  );
}
