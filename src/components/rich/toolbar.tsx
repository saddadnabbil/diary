"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useRef, type ReactNode } from "react";
import { cx } from "../ui";

function Btn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // keep the caret in the editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        "flex size-9 items-center justify-center rounded-full text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg disabled:opacity-40",
        active ? "bg-primary text-on-primary" : "text-fg-2 hover:bg-surface-hover hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

const stroke = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function EditorToolbar({ editor, onFiles }: { editor: Editor | null; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: !!editor?.isActive("bold"),
      italic: !!editor?.isActive("italic"),
      bullet: !!editor?.isActive("bulletList"),
      ordered: !!editor?.isActive("orderedList"),
      canIndent: !!editor?.can().sinkListItem("listItem"),
      canOutdent: !!editor?.can().liftListItem("listItem"),
    }),
  });
  if (!editor || !s) return <div className="h-9" aria-hidden="true" />;
  const run = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
      <Btn label="Bold (Ctrl+B)" active={s.bold} onClick={() => run().toggleBold().run()}>
        <span className="font-semibold">B</span>
      </Btn>
      <Btn label="Italic (Ctrl+I)" active={s.italic} onClick={() => run().toggleItalic().run()}>
        <span className="italic">I</span>
      </Btn>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
      <Btn label="Bulleted list" active={s.bullet} onClick={() => run().toggleBulletList().run()}>
        <svg {...stroke}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg>
      </Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => run().toggleOrderedList().run()}>
        <span className="text-[13px] font-medium tracking-tight">1.</span>
      </Btn>
      <Btn label="Indent (Tab)" disabled={!s.canIndent} onClick={() => run().sinkListItem("listItem").run()}>
        <svg {...stroke}><path d="M4 6h16M12 12h8M12 18h8M4 9l3 3-3 3" /></svg>
      </Btn>
      <Btn label="Outdent (Shift+Tab)" disabled={!s.canOutdent} onClick={() => run().liftListItem("listItem").run()}>
        <svg {...stroke}><path d="M4 6h16M12 12h8M12 18h8M7 9l-3 3 3 3" /></svg>
      </Btn>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
      <Btn label="Add image" onClick={() => input.current?.click()}>
        <svg {...stroke}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.5" /><path d="m4 17 5-4.500 3.500 3 3-2.500 4.500 4" /></svg>
      </Btn>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
