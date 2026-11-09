"use client";

import { EditorContent, getMarkRange, useEditor, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseBody } from "@/lib/rich";
import { cx } from "../ui";
import { baseExtensions, HIGHLIGHT_COLORS, type HighlightColor } from "./extensions";

interface Span {
  from: number;
  to: number;
  text: string;
  color: HighlightColor;
  note: string;
}

interface Pop {
  left: number;
  top: number;
  from: number;
  to: number;
  existing: { color: HighlightColor; note: string } | null;
}

const DOT: Record<HighlightColor, string> = { yellow: "bg-[var(--hl-yellow)]", green: "bg-[var(--hl-green)]", pink: "bg-[var(--hl-pink)]" };

/** Highlighted passages in reading order (adjacent pieces with the same colour and note are merged). */
function collect(editor: Editor): Span[] {
  const spans: Span[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const m = node.marks.find((x) => x.type.name === "highlight");
    if (!m) return;
    const color = (m.attrs.color as HighlightColor) ?? "yellow";
    const note = (m.attrs.note as string) ?? "";
    const prev = spans[spans.length - 1];
    if (prev && prev.to === pos && prev.color === color && prev.note === note) {
      prev.to = pos + node.nodeSize;
      prev.text += node.text ?? "";
    } else spans.push({ from: pos, to: pos + node.nodeSize, text: node.text ?? "", color, note });
  });
  return spans;
}

/**
 * Read-only entry view where text can be highlighted and annotated, like a book.
 * Highlights live in the entry body, so they sync like everything else.
 */
export function AnnotatableView({ body, onBodyChange }: { body: string; onBodyChange: (json: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const emitted = useRef(body);
  const [pop, setPop] = useState<Pop | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const editor = useEditor({
    extensions: baseExtensions,
    content: parseBody(body),
    editable: false,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      emitted.current = json;
      onBodyChange(json);
    },
  });

  // Take in changes that did not come from here (for example a sync from another device).
  useEffect(() => {
    if (!editor || editor.isDestroyed || body === emitted.current) return;
    emitted.current = body;
    editor.commands.setContent(parseBody(body), { emitUpdate: false });
  }, [editor, body]);


  const close = useCallback(() => {
    setPop(null);
    setNoteOpen(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Selecting text opens the toolbar under the selection.
  useEffect(() => {
    if (!editor) return;
    let t: ReturnType<typeof setTimeout>;
    const onSelect = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount || !wrap.current) return;
        const range = sel.getRangeAt(0);
        if (!wrap.current.contains(range.commonAncestorContainer) || editor.isDestroyed) return;
        const a = editor.view.posAtDOM(range.startContainer, range.startOffset);
        const b = editor.view.posAtDOM(range.endContainer, range.endOffset);
        const from = Math.min(a, b);
        const to = Math.max(a, b);
        if (from === to) return;
        const rect = range.getBoundingClientRect();
        const overlap = collect(editor).find((s) => s.from < to && s.to > from);
        setNoteOpen(false);
        setDraft(overlap?.note ?? "");
        setPop({ left: rect.left, top: rect.bottom, from, to, existing: overlap ? { color: overlap.color, note: overlap.note } : null });
      }, 150);
    };
    document.addEventListener("selectionchange", onSelect);
    return () => {
      clearTimeout(t);
      document.removeEventListener("selectionchange", onSelect);
    };
  }, [editor]);

  useEffect(() => {
    if (!pop) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onScroll = () => !noteOpen && setPop(null);
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as HTMLElement;
      if (popRef.current?.contains(t) || t.closest?.("mark.hl")) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pop, noteOpen, close]);

  // Tapping an existing highlight opens it for editing.
  function onClick(e: React.MouseEvent) {
    if (!editor || !window.getSelection()?.isCollapsed) return;
    const el = (e.target as HTMLElement).closest("mark.hl");
    if (!el) return;
    const pos = editor.view.posAtDOM(el, 0);
    const range = getMarkRange(editor.state.doc.resolve(pos + 1), editor.schema.marks.highlight);
    if (!range) return;
    const span = collect(editor).find((s) => s.from <= range.from && s.to >= range.to);
    const r = (el as HTMLElement).getBoundingClientRect();
    setDraft(span?.note ?? "");
    setNoteOpen(false);
    setPop({ left: r.left, top: r.bottom, from: span?.from ?? range.from, to: span?.to ?? range.to, existing: { color: span?.color ?? "yellow", note: span?.note ?? "" } });
  }

  function apply(color: HighlightColor, note: string) {
    if (!editor || !pop) return;
    editor.chain().setTextSelection({ from: pop.from, to: pop.to }).unsetMark("highlight").setMark("highlight", { color, note }).run();
    close();
  }
  function remove() {
    if (!editor || !pop) return;
    editor.chain().setTextSelection({ from: pop.from, to: pop.to }).unsetMark("highlight").run();
    close();
  }
  const color = pop?.existing?.color ?? "yellow";

  return (
    <>
      <div ref={wrap} onClick={onClick}>
        <EditorContent editor={editor} className="rich text-[17px] leading-7 md:text-[18px] md:leading-8" />
      </div>
      {pop && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Highlight"
          style={{ left: Math.max(8, Math.min(pop.left, window.innerWidth - 316)), top: Math.min(pop.top + 8, window.innerHeight - 240) }}
          className="fixed z-40 w-[308px] rounded-2xl border border-line bg-bg p-3.5 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.35)]"
          onMouseDown={(e) => e.target instanceof HTMLTextAreaElement || e.preventDefault() /* keep the text selected */}
        >
          <div className="flex items-center gap-2.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Highlight ${c}`}
                aria-pressed={pop.existing?.color === c}
                onClick={() => apply(c, pop.existing?.note ?? draft)}
                className={cx("size-7 rounded-full border border-line transition-transform hover:scale-105", DOT[c], pop.existing?.color === c && "outline-2 outline-offset-2 outline-fg")}
              />
            ))}
            {pop.existing && (
              <button type="button" onClick={remove} className="ml-auto whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] leading-[18px] text-fg-2 hover:bg-surface-hover hover:text-fg">
                Remove
              </button>
            )}
          </div>

          {!noteOpen && pop.existing?.note && (
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-surface px-3 py-2.5 text-[14px] leading-5">{pop.existing.note}</p>
          )}

          {noteOpen ? (
            <div className="mt-3 flex flex-col gap-2.5">
              <label className="sr-only" htmlFor="hl-note">Note</label>
              <textarea
                id="hl-note"
                autoFocus
                maxLength={500}
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Why does this matter?"
                className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] leading-5 placeholder:text-fg-3 focus:border-fg focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNoteOpen(false)} className="rounded-full px-3.5 py-1.5 text-[13px] text-fg-2 hover:bg-surface-hover">
                  Cancel
                </button>
                <button type="button" onClick={() => apply(color, draft.trim())} className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-on-primary hover:opacity-90">
                  Save note
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="mt-3 w-full whitespace-nowrap rounded-xl border border-line px-3 py-2 text-left text-[13px] font-medium leading-[18px] hover:bg-surface"
            >
              {pop.existing?.note ? "Edit note" : "+ Add a note"}
            </button>
          )}
        </div>
      )}

    </>
  );
}
