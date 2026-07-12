"use client";

import { useRef, useState } from "react";

/* Textarea with a Reddit-style formatting toolbar. The toolbar is hidden behind
   an "Aa" toggle (bottom-left) and inserts markdown that the Markdown renderer
   understands. Behaves like a controlled textarea (value / onChange). The
   textarea element is read only inside click handlers (never during render). */

type Editor = {
  value: string;
  onChange: (v: string) => void;
  ta: HTMLTextAreaElement;
};

function surround(e: Editor, pre: string, post: string, placeholder = "") {
  const { value, onChange, ta } = e;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const before = value.slice(0, start);
  const sel = value.slice(start, end) || placeholder;
  onChange(before + pre + sel + post + value.slice(end));
  const s = before.length + pre.length;
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(s, s + sel.length);
  });
}

function prefixLines(e: Editor, makePrefix: (i: number) => string) {
  const { value, onChange, ta } = e;
  const lineStart = value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
  let lineEnd = value.indexOf("\n", ta.selectionEnd);
  if (lineEnd === -1) lineEnd = value.length;
  const newBlock = value
    .slice(lineStart, lineEnd)
    .split("\n")
    .map((ln, i) => makePrefix(i) + ln)
    .join("\n");
  onChange(value.slice(0, lineStart) + newBlock + value.slice(lineEnd));
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(lineStart, lineStart + newBlock.length);
  });
}

function insertBlock(e: Editor, snippet: string) {
  const { value, onChange, ta } = e;
  const before = value.slice(0, ta.selectionStart);
  const after = value.slice(ta.selectionEnd);
  const nl = before && !before.endsWith("\n") ? "\n" : "";
  onChange(before + nl + snippet + after);
  const pos = (before + nl + snippet).length;
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(pos, pos);
  });
}

type Tool = { key: string; label: string; cls?: string; title: string; run: (e: Editor) => void };

const TOOLS: Tool[] = [
  { key: "bold", label: "B", cls: "font-black", title: "Bold", run: (e) => surround(e, "**", "**", "bold") },
  { key: "italic", label: "i", cls: "italic", title: "Italic", run: (e) => surround(e, "*", "*", "italic") },
  { key: "strike", label: "S", cls: "line-through", title: "Strikethrough", run: (e) => surround(e, "~~", "~~", "text") },
  { key: "sup", label: "x²", title: "Superscript", run: (e) => surround(e, "^(", ")", "sup") },
  { key: "heading", label: "H", cls: "font-black", title: "Heading", run: (e) => prefixLines(e, () => "# ") },
  { key: "link", label: "🔗", title: "Link", run: (e) => surround(e, "[", "](https://)", "text") },
  { key: "ul", label: "•—", title: "Bullet list", run: (e) => prefixLines(e, () => "- ") },
  { key: "ol", label: "1.", title: "Numbered list", run: (e) => prefixLines(e, (i) => `${i + 1}. `) },
  { key: "spoiler", label: "!", title: "Spoiler", run: (e) => surround(e, ">!", "!<", "spoiler") },
  { key: "quote", label: "❝", title: "Quote block", run: (e) => prefixLines(e, () => "> ") },
  { key: "code", label: "</>", title: "Code", run: (e) => surround(e, "`", "`", "code") },
  { key: "codeblock", label: "{ }", title: "Code block", run: (e) => insertBlock(e, "```\ncode\n```\n") },
  { key: "table", label: "▦", title: "Table", run: (e) => insertBlock(e, "| Col A | Col B |\n| --- | --- |\n| 1 | 2 |\n") },
];

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
  autoFocus = false,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showTools, setShowTools] = useState(false);

  return (
    <div>
      {showTools && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1 rounded-lg border border-line bg-elevated p-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.title}
              aria-label={t.title}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => {
                const ta = ref.current;
                if (ta) t.run({ value, onChange, ta });
              }}
              className={`grid h-7 min-w-7 place-items-center rounded px-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-neutral-100 ${t.cls ?? ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
      />

      <div className="mt-1">
        <button
          type="button"
          onClick={() => setShowTools((v) => !v)}
          aria-expanded={showTools}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <span className="grid h-5 w-5 place-items-center rounded border border-line text-[11px] font-bold">
            Aa
          </span>
          {showTools ? "Hide formatting options" : "Show formatting options"}
        </button>
      </div>
    </div>
  );
}
