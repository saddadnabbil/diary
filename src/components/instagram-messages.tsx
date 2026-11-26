"use client";

import Image from "next/image";
import { useState } from "react";
import { Page } from "@/components/page";
import { Button, LinkButton, PageTitle, cx } from "@/components/ui";
import type { DemoInbox } from "@/lib/server/instagram-archive";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export function InstagramMessages({ inbox }: { inbox: DemoInbox }) {
  const [selected, setSelected] = useState<string | null>(null);
  const thread = inbox.find(({ id }) => id === selected) ?? inbox[0];

  return (
    <Page wide>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle sub="Sample conversations from the Instagram archive.">Messages.</PageTitle>
        <LinkButton href="/archive" variant="secondary">Back to archive</LinkButton>
      </div>
      <div className="mt-8 overflow-hidden rounded-[20px] border border-line md:grid md:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Conversations" className={cx("bg-surface p-3 md:block md:border-r md:border-line", selected && "hidden")}>
          {inbox.map(({ title, id }) => (
            <button
              key={id}
              type="button"
              aria-current={thread?.id === id ? "true" : undefined}
              onClick={() => setSelected(id)}
              className={cx("w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-surface-hover focus-visible:outline-2", thread?.id === id && "bg-bg font-medium")}
            >
              {title}
            </button>
          ))}
        </nav>
        {thread && (
          <section aria-label={"Conversation with " + thread.title} className={cx("min-w-0 md:block", !selected && "hidden")}>
            <header className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Button type="button" variant="ghost" className="md:hidden" onClick={() => setSelected(null)}>Back</Button>
              <h2 className="font-medium">{thread.title}</h2>
            </header>
            <ol className="flex min-h-72 flex-col gap-4 p-4 sm:p-6">
              {thread.messages.map((message) => (
                <li key={message.id} className={cx("flex w-fit max-w-[90%] flex-col gap-1.5", message.outgoing ? "self-end" : "self-start")}>
                  <p className={cx("text-xs text-fg-2", message.outgoing && "text-right")}>
                    {message.sender} · <time dateTime={new Date(message.createdAt).toISOString()}>{dateTime.format(message.createdAt)}</time>
                  </p>
                  <div className={cx("flex flex-col gap-2 rounded-2xl p-2", message.outgoing ? "bg-surface-hover" : "bg-surface")}>
                    {message.text && <p className="whitespace-pre-wrap break-words px-2 text-sm">{message.text}</p>}
                    {message.photos.map((photo) => photo.src ? (
                      <div key={photo.uri} className="relative aspect-[4/3] w-64 max-w-full overflow-hidden rounded-xl">
                        <Image src={photo.src} alt={photo.alt} fill unoptimized sizes="256px" className="object-contain" />
                      </div>
                    ) : <p key={photo.uri} className="px-2 text-sm text-fg-2">Photo unavailable.</p>)}
                    {message.videos.map((video) => video.src ? (
                      <video key={video.uri} src={video.src} controls playsInline preload="metadata" aria-label="Video attachment" className="w-72 max-w-full rounded-xl bg-black" />
                    ) : <p key={video.uri} className="px-2 text-sm text-fg-2">Video unavailable.</p>)}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </Page>
  );
}
