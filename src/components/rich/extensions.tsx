"use client";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark, Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useLiveQuery } from "dexie-react-hooks";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { createContext, useContext } from "react";
import { MediaStrip } from "@/components/media-strip";
import { cx } from "@/components/ui";
import { db } from "@/lib/db";
import { embedHeight, embedUrl, parseStoredMusicUri, providerName, type MusicRef } from "@/lib/music";

// Object URLs are cached per image for the life of the page: cheap, and safe under React strict mode.
const urlCache = new Map<string, string>();

/** Object URL for an image stored on this device. undefined while loading, null when not on this device. */
export function useImageUrl(imageId: string | null): string | null | undefined {
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

/** Opens the full-screen viewer at one photo of the entry (by image id). Reading view only. */
export const OpenPhotoContext = createContext<((imageId: string) => void) | null>(null);

interface RunPhoto {
  imageId: string;
  pos: number;
}
const runKey = new PluginKey<DecorationSet>("photoRuns");

/**
 * Photos in a row (only blank lines between them) show as one slider, like X's multi-photo posts.
 * The body is untouched: the first photo of a run draws the whole row, the rest of the run is hidden.
 */
function photoRunDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  const blocks: { node: PMNode; pos: number }[] = [];
  doc.forEach((node, pos) => blocks.push({ node, pos }));
  const isPhoto = (n: PMNode) => n.type.name === "image" && typeof n.attrs.imageId === "string";
  const isBlank = (n: PMNode) => n.type.name === "paragraph" && n.content.size === 0;
  for (let i = 0; i < blocks.length; i++) {
    if (!isPhoto(blocks[i].node)) continue;
    let end = i;
    for (let j = i + 1; j < blocks.length; j++) {
      if (isPhoto(blocks[j].node)) end = j;
      else if (!isBlank(blocks[j].node)) break;
    }
    const run: RunPhoto[] = blocks.slice(i, end + 1).filter((b) => isPhoto(b.node)).map((b) => ({ imageId: b.node.attrs.imageId as string, pos: b.pos }));
    const first = blocks[i];
    decos.push(Decoration.node(first.pos, first.pos + first.node.nodeSize, { "data-run": JSON.stringify(run) }, { run }));
    for (const b of blocks.slice(i + 1, end + 1)) decos.push(Decoration.node(b.pos, b.pos + b.node.nodeSize, { class: "photo-run-hidden" }));
    i = end;
  }
  return DecorationSet.create(doc, decos);
}

function ImageView({ node, selected, decorations, editor }: NodeViewProps) {
  const imageId = (node.attrs.imageId as string | null) ?? null;
  const open = useContext(OpenPhotoContext);
  const runDeco = decorations.find((d) => (d as unknown as { spec?: { run?: RunPhoto[] } }).spec?.run);
  const run = ((runDeco as unknown as { spec?: { run?: RunPhoto[] } })?.spec?.run ?? [{ imageId, pos: -1 }]) as RunPhoto[];
  const editable = editor.isEditable;

  function remove(i: number) {
    const target = run[i];
    const n = target && editor.state.doc.nodeAt(target.pos);
    if (!n) return;
    editor.chain().focus().deleteRange({ from: target.pos, to: target.pos + n.nodeSize }).run();
  }

  return (
    <NodeViewWrapper
      // Only show the selection while editing: a read-only view can still "select" its first photo.
      className={cx("my-4 rounded-[16px]", editable && selected && "outline-2 outline-offset-2 outline-fg/60")}
      contentEditable={false}
    >
      <MediaStrip
        maxHeight={460}
        items={run.map((r) => ({ mediaId: r.imageId }))}
        onOpen={!editable && open ? (i) => open(run[i].imageId!) : undefined}
        onRemove={editable ? remove : undefined}
      />
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
    // Re-render when only the decorations change too: that is how a photo learns the rest of its run.
    return ReactNodeViewRenderer(ImageView, {
      update: ({ oldNode, newNode, updateProps }) => {
        if (newNode.type !== oldNode.type) return false;
        updateProps();
        return true;
      },
    });
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: runKey,
        state: {
          init: (_, state) => photoRunDecorations(state.doc),
          apply: (tr, old) => (tr.docChanged ? photoRunDecorations(tr.doc) : old),
        },
        props: { decorations: (state) => runKey.getState(state) },
      }),
    ];
  },
});

/** A music embed (Spotify or YouTube). The iframe URL is built from the validated id only. */
function MusicView({ node }: NodeViewProps) {
  const ref: MusicRef | null = parseStoredMusicUri(node.attrs.uri);
  return (
    <NodeViewWrapper className="my-4">
      {ref ? (
        <div className="overflow-hidden rounded-[24px]">
          <iframe
            title={`${providerName(ref.provider)} ${ref.kind}`}
            src={embedUrl(ref)}
            width="100%"
            height={embedHeight(ref)}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            className="block border-0"
          />
        </div>
      ) : (
        <p className="rounded-[14px] border border-line px-4 py-3 text-[13px] text-fg-3">This music link is not supported.</p>
      )}
    </NodeViewWrapper>
  );
}

const musicNode = (name: string) =>
  Node.create({
    name,
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,
    addAttributes() {
      return { uri: { default: null } };
    },
    parseHTML() {
      return [{ tag: `div[data-music]`, getAttrs: (el) => ({ uri: (el as HTMLElement).getAttribute("data-uri") }) }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", { "data-music": "", "data-uri": HTMLAttributes.uri }];
    },
    addNodeView() {
      return ReactNodeViewRenderer(MusicView);
    },
  });

/** A song, album, playlist or video from Spotify or YouTube. Stored as a URI only. */
export const MusicEmbed = musicNode("music");
/** Entries written before YouTube support used this name. Same view, so they keep loading. */
export const LegacySpotifyEmbed = musicNode("spotify");

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
  MusicEmbed,
  LegacySpotifyEmbed,
  Highlight,
];

export const editorExtensions = (placeholder: string) => [...baseExtensions, Placeholder.configure({ placeholder })];
