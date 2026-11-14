"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { db, ensureSeed } from "@/lib/db";
import type { Entry } from "@/lib/types";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

const img = (n: number) => ({ type: "image", attrs: { imageId: `dummy-img-${n}` } });
const p = (text?: string) => (text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" });
const doc = (...content: object[]) => JSON.stringify({ type: "doc", content });

/** Photos in public/dev-dummy (git-ignored, copied from the deployed app). */
const PHOTOS = 17;

export function SeedDummy() {
  const router = useRouter();
  const [status, setStatus] = useState("Seeding…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      await ensureSeed();
      const settings = await db.settings.get("me");
      // Never mix dummy data into a device that belongs to an account: it would sync.
      if (settings?.ownerId) {
        setStatus("This browser is signed in to an account. Open the app in a private window to seed dummy data.");
        return;
      }
      await db.settings.update("me", { onboarded: true, storageMode: "local", ownerId: null, displayName: "Nabbil" });

      const now = Date.now();
      for (let n = 1; n <= PHOTOS; n++) {
        const blob = await (await fetch(`/dev-dummy/${n}.webp`)).blob();
        await db.images.put({ id: `dummy-img-${n}`, blob, type: blob.type, createdAt: now, uploaded: 1 });
      }

      const old = await db.entries.filter((e) => e.id.startsWith("dummy-")).primaryKeys();
      await db.entries.bulkDelete(old);

      const base: Omit<Entry, "id" | "createdAt"> = { title: "", body: "", kind: "entry", mediaId: null, mood: null, promptUsed: null, updatedAt: now, deletedAt: null, dirty: 0 };
      const story = (id: string, n: number, ago: number, title: string): Entry => ({ ...base, id: `dummy-story-${id}`, kind: "story", mediaId: `dummy-img-${n}`, title, createdAt: now - ago });
      const entry = (id: string, ago: number, init: Partial<Entry>): Entry => ({ ...base, id: `dummy-entry-${id}`, createdAt: now - ago, ...init });

      await db.entries.bulkPut([
        story("a", 1, 1 * HOUR, "Pagi yang pelan."),
        story("b", 12, 2 * HOUR, ""),
        story("c", 3, 3 * HOUR, "Kopi kedua hari ini, dan masih belum cukup."),
        story("d", 13, 4 * HOUR, "Langit sore"),
        entry("e", 5 * HOUR, {
          title: "Jalan-jalan sore",
          mood: "Happy",
          body: doc(p("Sore ini jalan keliling sebentar. Banyak yang difoto, sedikit yang diingat."), img(14), p(), img(5), img(2), p("Pulang dengan kaki pegal tapi kepala ringan.")),
        }),
        story("f", 16, 1 * DAY + 2 * HOUR, "Lampu kota"),
        story("g", 6, 1 * DAY + 5 * HOUR, ""),
        entry("h", 2 * DAY, { title: "Satu foto saja", mood: "Calm", body: doc(p("Hari yang tenang."), img(9), p("Cukup satu foto untuk hari ini.")) }),
        story("i", 8, 3 * DAY, "Weekend"),
        entry("j", 4 * DAY, { title: "Catatan kecil", mood: "Grateful", body: doc(p("Beberapa hal kecil yang bikin senang minggu ini."), img(10), img(11), img(4), img(15), p("Semoga minggu depan juga begitu.")) }),
        story("k", 7, 5 * DAY, ""),
        story("l", 17, 5 * DAY + HOUR, "Rumah"),
        story("m", 15, 5 * DAY + 2 * HOUR, "Detail kecil"),
        entry("n", 6 * DAY, { title: "Tanpa foto", mood: "Tired", body: doc(p("Hari ini nggak ada foto. Cuma capek dan pengen tidur cepat.")) }),
      ]);
      setStatus("Done. Opening entries…");
      router.replace("/entries");
    })().catch((e: unknown) => setStatus(`Seeding failed: ${e instanceof Error ? e.message : String(e)}`));
  }, [router]);

  return <p className="p-10 text-[15px] text-fg-2">{status}</p>;
}
