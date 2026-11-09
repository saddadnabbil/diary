"use client";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { db } from "@/lib/db";
import { fetchRemoteImage } from "@/lib/sync";

// Object URLs are cached per image for the life of the page: cheap, and safe under React strict mode.
const urlCache = new Map<string, string>();

function useImageUrl(imageId: string | null): string | null | undefined {
  const stored = useLiveQuery(async () => (imageId ? ((await db.images.get(imageId)) ?? null) : null), [imageId]);
  if (stored === undefined) return undefined;
  if (stored === null) return null;
  let url = urlCache.get(stored.id);
  if (!url) {
    url = URL.createObjectURL(stored.blob);
    urlCache.set(stored.id, url);
  }
  return url;
}

function ImageView({ node, selected }: NodeViewProps) {
  const imageId = (node.attrs.imageId as string | null) ?? null;
  const url = useImageUrl(imageId);
  // Not on this device yet (added elsewhere): fetch it from the cloud.
  useEffect(() => {
    if (url === null && imageId) void fetchRemoteImage(imageId);
  }, [url, imageId]);
  return (
    <NodeViewWrapper className="my-3">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={`max-h-[520px] max-w-full rounded-[14px] border border-line ${selected ? "outline-2 outline-offset-2 outline-fg" : ""}`}
        />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-[14px] bg-surface text-[13px] text-fg-3">
          {url === undefined ? "Loading image…" : "Loading from cloud…"}
        </div>
      )}
    </NodeViewWrapper>
  );
}

/** Image node that points at a blob stored in IndexedDB (never at a remote URL). */
export const DiaryImage = Image.extend({
  addAttributes() {
    return { imageId: { default: null } };
  },
  parseHTML() {
    return [{ tag: "img[data-image-id]", getAttrs: (el) => ({ imageId: (el as HTMLElement).getAttribute("data-image-id") }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", { "data-image-id": HTMLAttributes.imageId }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

export const HIGHLIGHT_COLORS = ["yellow", "green", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/** A highlighted passage, optionally with a note. Stored in the entry body like any other formatting. */
export const Highlight = Mark.create({
  name: "highlight",
  inclusive: false,
  addAttributes() {
    return {
      color: { default: "yellow", parseHTML: (el) => el.getAttribute("data-color") ?? "yellow" },
      note: { default: "", parseHTML: (el) => el.getAttribute("data-note") ?? "" },
    };
  },
  parseHTML() {
    return [{ tag: "mark" }];
  },
  renderHTML({ HTMLAttributes }) {
    const color = (HIGHLIGHT_COLORS as readonly string[]).includes(HTMLAttributes.color) ? HTMLAttributes.color : "yellow";
    return ["mark", { "data-color": color, "data-note": HTMLAttributes.note || undefined, class: "hl" }, 0];
  },
});

export const baseExtensions = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    code: false,
    blockquote: false,
    horizontalRule: false,
    strike: false,
    link: false,
    underline: false,
  }),
  DiaryImage,
  Highlight,
];

export const editorExtensions = (placeholder: string) => [...baseExtensions, Placeholder.configure({ placeholder })];
