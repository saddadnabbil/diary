"use client";

import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEntry } from "@/hooks/use-entries";
import { useSuggestions } from "@/hooks/use-suggestions";
import { createEntry, saveEntry } from "@/lib/db";
import { wordCount } from "@/lib/dates";
import { ImageError, storeImage } from "@/lib/images";
import { isEmptyBody, parseBody, plainText } from "@/lib/rich";
import { MAX_BODY_CHARS } from "@/lib/sync-schema";
import { MOODS, type Entry, type Mood, type Suggestion } from "@/lib/types";
import { DatePicker } from "./date-picker";
import { editorExtensions } from "./rich/extensions";
import { EditorToolbar } from "./rich/toolbar";
import { ModelBadge, ShuffleButton, SourceNote, SuggestionCard, SuggestionSkeleton } from "./suggestions";
import { Button, Chip } from "./ui";

/** Loads the entry (when editing) and mounts the form once it is ready. */
export function Editor({ id, initialPrompt, initialDate }: { id?: string; initialPrompt?: string; initialDate?: number }) {
  const existing = useEntry(id ?? "__new__");

  if (!id) return <EditorForm initialPrompt={initialPrompt} initialDate={initialDate} />;
  if (existing === undefined) return <EditorMessage>Loading…</EditorMessage>;
  if (existing === null) return <EditorMessage>This entry no longer exists.</EditorMessage>;
  return <EditorForm key={id} entry={existing} />;
}

function EditorMessage({ children }: { children: string }) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pt-8">
      <p className="text-[15px] leading-6 text-fg-2">{children}</p>
    </main>
  );
}

function EditorForm({ entry, initialPrompt, initialDate }: { entry?: Entry; initialPrompt?: string; initialDate?: number }) {
  const router = useRouter();

  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [mood, setMood] = useState<Mood | null>(entry?.mood ?? null);
  const [prompt, setPrompt] = useState<string | null>(entry?.promptUsed ?? initialPrompt ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [createdAt, setCreatedAt] = useState(() => entry?.createdAt ?? initialDate ?? Date.now());

  const entryId = useRef<string | null>(entry?.id ?? null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ title, body, mood, prompt, createdAt });
  const editorRef = useRef<TiptapEditor | null>(null);

  useEffect(() => {
    latest.current = { title, body, mood, prompt, createdAt };
  }, [title, body, mood, prompt, createdAt]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const { title, body, mood, prompt, createdAt } = latest.current;
    if (!entryId.current) {
      if (!title.trim() && isEmptyBody(body)) return; // never create an empty entry
      entryId.current = (await createEntry({ title, body, mood, promptUsed: prompt, createdAt, updatedAt: Date.now() })).id;
    } else {
      await saveEntry(entryId.current, { title, body, mood, promptUsed: prompt, createdAt });
    }
  }, []);

  const touch = useCallback(() => {
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  }, [flush]);

  // Save anything pending when leaving the page.
  useEffect(() => () => void flush(), [flush]);

  const insertFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    for (const file of images) {
      try {
        const imageId = await storeImage(file);
        editorRef.current?.chain().focus().insertContent({ type: "image", attrs: { imageId } }).run();
        setNotice(null);
      } catch (e) {
        setNotice(e instanceof ImageError ? e.message : "Could not add that image.");
      }
    }
  }, []);

  const editor = useEditor({
    extensions: editorExtensions("Start writing…"),
    content: parseBody(entry?.body ?? ""),
    immediatelyRender: false,
    autofocus: entry ? false : "end",
    editorProps: {
      attributes: { "aria-label": "Write here", "aria-multiline": "true" },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        void insertFiles(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        void insertFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      if (json.length > MAX_BODY_CHARS) {
        setNotice("This entry is too long to save. Remove some content.");
        return;
      }
      setNotice(null);
      setBody(json);
      touch();
    },
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const { suggestions, loading, source, notice: modelNotice, refresh } = useSuggestions(mood, 3);

  function pick(s: Suggestion) {
    setPrompt(s.text);
    touch();
    editor?.commands.focus();
  }

  async function done() {
    await flush();
    router.push(entryId.current ? `/entries/${entryId.current}` : "/dashboard");
  }

  const words = wordCount(plainText(body));

  return (
    <>
    <main className="mx-auto grid w-full max-w-[1120px] flex-1 grid-cols-1 gap-10 px-6 pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-24">
      <section aria-label="Entry" className="min-w-0">
        {/* Stays at the top while scrolling so Done and formatting are always reachable. */}
        <div className="sticky top-0 z-20 -mx-6 border-b border-line bg-bg/95 px-6 pb-2 pt-3 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
          <div className="flex items-center justify-between gap-4">
            <DatePicker
              value={createdAt}
              onChange={(ms) => {
                setCreatedAt(ms);
                touch();
              }}
            />
            <Button variant="primary" onClick={done} className="!py-2">
              Done
            </Button>
          </div>
          <div className="-ml-2 mt-1">
            <EditorToolbar editor={editor} onFiles={(f) => void insertFiles(f)} />
          </div>
        </div>

        <div className="no-scrollbar -mx-6 mt-5 flex items-center gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Mood">
          <span className="mr-1 shrink-0 text-[13px] leading-[18px] text-fg-3">Mood</span>
          {MOODS.map((m) => (
            <Chip
              key={m}
              selected={mood === m}
              onClick={() => {
                setMood(mood === m ? null : m);
                touch();
              }}
            >
              {m}
            </Chip>
          ))}
        </div>

        {prompt && (
          <p className="mt-6 flex items-start gap-2 text-[15px] leading-6 text-fg-2">
            <span className="mt-px text-fg-3">Prompt</span>
            <span className="italic">{prompt}</span>
            <button
              type="button"
              aria-label="Remove prompt"
              onClick={() => {
                setPrompt(null);
                touch();
              }}
              className="ml-1 text-fg-3 hover:text-fg"
            >
              ×
            </button>
          </p>
        )}

        <label className="sr-only" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            touch();
          }}
          placeholder="Title"
          maxLength={200}
          autoComplete="off"
          className="display mt-6 w-full bg-transparent text-[26px] leading-8 placeholder:text-fg-3 focus:outline-none md:text-[36px] md:leading-[44px]"
        />

        <EditorContent editor={editor} className="rich mt-4 min-h-[200px] text-[17px] leading-7 md:text-[18px] md:leading-8" />

        <p className="mt-6 text-[13px] leading-[18px] text-fg-3" aria-live="polite">
          {words} {words === 1 ? "word" : "words"}
          {notice && <span className="ml-2 text-fg">· {notice}</span>}
        </p>
      </section>

      <aside aria-label="Writing suggestions" className="hidden flex-col gap-4 pt-5 lg:flex lg:pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] leading-5 font-medium">Need a nudge?</h2>
          <ModelBadge source={source} />
        </div>
        {loading && suggestions.length === 0 ? (
          <SuggestionSkeleton />
        ) : (
          suggestions.map((s) => <SuggestionCard key={s.text} suggestion={s} onPick={pick} />)
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ShuffleButton onClick={refresh} loading={loading} />
          <SourceNote source={source} notice={modelNotice} mood={mood} />
        </div>
      </aside>
    </main>

    {/* Mobile and tablet: one suggestion above the keyboard, the rest on demand. */}
    <div className="sticky bottom-0 z-20 border-t border-line bg-bg pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      {sheet && (
        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-5 pt-4">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.text}
              suggestion={s}
              onPick={(x) => {
                pick(x);
                setSheet(false);
              }}
            />
          ))}
          <div className="flex items-center gap-3 pb-1">
            <ShuffleButton onClick={refresh} loading={loading} />
            <SourceNote source={source} notice={modelNotice} mood={mood} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 px-5 pt-3">
        <button
          type="button"
          disabled={!suggestions[0]}
          onClick={() => suggestions[0] && pick(suggestions[0])}
          aria-label={suggestions[0] ? `Use this prompt: ${suggestions[0].text}` : "Prompt loading"}
          className="min-w-0 flex-1 rounded-xl py-1 text-left text-[14px] leading-5 text-fg-2 active:bg-surface"
        >
          {loading && !suggestions.length ? "Finding a prompt…" : (suggestions[0]?.text ?? "Need a nudge?")}
          {suggestions[0] && <span className="ml-1.5 font-medium text-fg">Use</span>}
        </button>
        <Button variant="secondary" onClick={() => setSheet((v) => !v)} aria-expanded={sheet}>
          {sheet ? "Close" : "More"}
        </Button>
      </div>
    </div>
    </>
  );
}
