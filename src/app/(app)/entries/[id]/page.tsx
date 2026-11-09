"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import { BackIcon } from "@/components/icons";
import { Page } from "@/components/page";
import { SuggestionCard } from "@/components/suggestions";
import { Button, LinkButton } from "@/components/ui";
import { BackToTop } from "@/components/back-to-top";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AnnotatableView } from "@/components/rich/annotatable-view";
import { useEntry } from "@/hooks/use-entries";
import { deleteEntry, saveEntry } from "@/lib/db";
import { formatLong, formatTime, wordCount } from "@/lib/dates";
import { plainText } from "@/lib/rich";
import { pickPrompts } from "@/lib/prompts";

export default function EntryDetailPage({ params }: PageProps<"/entries/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const entry = useEntry(id);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Static prompts here: reading an entry should not spend a model call.
  const followUp = useMemo(() => pickPrompts({ mood: entry?.mood ?? null, count: 1 })[0], [entry?.mood]);

  if (entry === undefined) return <Page><p className="text-[15px] text-fg-2">Loading…</p></Page>;
  if (entry === null) {
    return (
      <Page>
        <h1 className="display text-[36px] leading-10">Entry not found.</h1>
        <p className="mt-3 text-[17px] leading-7 text-fg-2">It may have been deleted.</p>
        <LinkButton href="/entries" className="mt-6">
          Back to entries
        </LinkButton>
      </Page>
    );
  }

  const words = wordCount(plainText(entry.body));

  return (
    <Page>
      <div className="flex items-center justify-between">
        <Link href="/entries" aria-label="Back to entries" className="-ml-1 rounded-full p-1 text-fg hover:bg-surface-hover">
          <BackIcon />
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Delete
          </Button>
          <LinkButton href={`/write/${entry.id}`} variant="secondary">
            Edit
          </LinkButton>
        </div>
      </div>

      <p className="mt-8 text-[13px] leading-[18px] text-fg-3 md:text-[14px] md:leading-5">
        {formatLong(entry.createdAt)}  ·  {formatTime(entry.createdAt)}
      </p>
      {entry.mood && (
        <p className="mt-3 inline-block rounded-full border border-line px-3.5 py-1.5 text-[13px] leading-[18px] text-fg-2">{entry.mood}</p>
      )}
      <h1 className="display mt-5 text-[28px] leading-8 md:text-[44px] md:leading-[48px]">{entry.title.trim() || "Untitled"}</h1>

      {entry.promptUsed && (
        <p className="mt-6 text-[15px] leading-6 text-fg-2">
          <span className="text-fg-3">Prompt</span> <span className="italic">{entry.promptUsed}</span>
        </p>
      )}

      <div className="mt-6">
        <AnnotatableView body={entry.body} onBodyChange={(json) => void saveEntry(entry.id, { body: json })} />
      </div>

      <p className="mt-10 text-[13px] leading-[18px] text-fg-3">
        {words} {words === 1 ? "word" : "words"}
      </p>

      {followUp && (
        <section aria-label="Keep going" className="mt-10">
          <h2 className="sr-only">Keep going</h2>
          <SuggestionCard suggestion={{ category: "Keep going", text: followUp.text }} />
          <div className="mt-3">
            <LinkButton href={`/write?prompt=${encodeURIComponent(followUp.text)}`} variant="secondary">
              Write about this
            </LinkButton>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this entry?"
        description="It will be removed from all your devices. This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setDeleting(true);
          await deleteEntry(entry.id);
          router.replace("/entries");
        }}
      />
      <BackToTop />
    </Page>
  );
}
