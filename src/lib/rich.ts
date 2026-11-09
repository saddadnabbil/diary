/**
 * Entry bodies are stored as a JSON string of a rich-text document (Tiptap/ProseMirror).
 * Older entries (and imports) hold plain text; those are converted on read.
 */
export interface RichNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: RichNode[];
}
export interface RichDoc {
  type: "doc";
  content: RichNode[];
}

const EMPTY: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };

export function plainTextToDoc(text: string): RichDoc {
  if (!text.trim()) return EMPTY;
  return {
    type: "doc",
    content: text.split(/\r?\n/).map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
  };
}

/** Parse a stored body. Never throws: anything that is not a rich document is treated as plain text. */
export function parseBody(body: string): RichDoc {
  const t = body.trimStart();
  if (t.startsWith("{")) {
    try {
      const v = JSON.parse(body) as RichDoc;
      if (v && v.type === "doc" && Array.isArray(v.content)) return v;
    } catch {
      /* fall through: it is plain text that happens to start with "{" */
    }
  }
  return plainTextToDoc(body);
}

const BLOCKS = new Set(["paragraph", "listItem", "bulletList", "orderedList", "heading", "blockquote"]);

function collect(node: RichNode, out: string[]) {
  if (node.type === "text" && node.text) out.push(node.text);
  for (const child of node.content ?? []) collect(child, out);
  if (BLOCKS.has(node.type)) out.push("\n");
}

/** Visible text of a body (no formatting, no images). Used for previews, search and word counts. */
export function plainText(body: string): string {
  const out: string[] = [];
  collect(parseBody(body), out);
  return out.join("").replace(/\n{2,}/g, "\n").trim();
}

/** Ids of images referenced by a body. */
export function imageIds(body: string): string[] {
  const ids = new Set<string>();
  const walk = (n: RichNode) => {
    if (n.type === "image" && typeof n.attrs?.imageId === "string") ids.add(n.attrs.imageId);
    n.content?.forEach(walk);
  };
  walk(parseBody(body));
  return [...ids];
}

export const isEmptyBody = (body: string) => plainText(body) === "" && imageIds(body).length === 0;
