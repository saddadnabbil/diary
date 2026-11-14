import { notFound } from "next/navigation";
import { SeedDummy } from "./seed-dummy";

/** Development only: fills this browser with dummy stories and entries for previewing the UI. */
export default function SeedPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SeedDummy />;
}
