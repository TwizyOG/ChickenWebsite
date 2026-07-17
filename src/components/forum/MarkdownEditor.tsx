"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_MB,
  mediaPublicUrl,
  requestUploadTickets,
  uploadToSignedUrl,
} from "@/lib/forumMedia";

/* Reddit-style comment box: one rounded container holding an optional
   formatting toolbar (top), the textarea, and a footer with the "Aa" toggle
   (bottom-left) plus caller-supplied action buttons (bottom-right). Toolbar
   buttons insert markdown that src/lib/markdown.tsx understands. Image/GIF
   files dragged or pasted into the box (or picked via the "…" menu) upload
   through the signed-URL flow and land as ![image](url) markdown at the caret.
   The textarea element is read only inside event handlers (never in render). */

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

/* ------------------------------------------------------------------- icons */
/* Original hand-drawn glyphs (20×20, currentColor) approximating the usual
   editor symbols. Letterform buttons stay real text for crispness. */

const I = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const ICONS = {
  link: (
    <I>
      <path d="M8.5 11.5l3-3" />
      <path d="M7 13l-1.2 1.2a2.9 2.9 0 01-4.1-4.1L4.9 7 M13 7l1.2-1.2a2.9 2.9 0 014.1 4.1L15.1 13" transform="translate(0.5 0)" />
    </I>
  ),
  ul: (
    <I>
      <path d="M7 5.5h9M7 10h9M7 14.5h9" />
      <path d="M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01" strokeWidth="2.4" />
    </I>
  ),
  ol: (
    <I>
      <path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5" />
      <path d="M3 4.2l1.2-.7v3M3.1 9.2c.9-1 2.2-.4 1.8.6l-1.8 1.7h2.1M3.1 13.4h1.4a.9.9 0 010 1.8H4a.9.9 0 010 1.8H3" strokeWidth="1.2" />
    </I>
  ),
  spoiler: (
    <I>
      <path d="M10 2.5l7.5 7.5-7.5 7.5L2.5 10z" />
      <path d="M10 6.5v4M10 13.5h.01" strokeWidth="1.8" />
    </I>
  ),
  quote: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M4.5 5.5A3.4 3.4 0 001.9 9c0 1.8 1.3 3.1 3 3.1.3 0 .5 0 .8-.1-.5 1.3-1.5 2.2-2.9 2.7l.7 1.4c2.9-.9 4.9-3.4 4.9-6.5 0-2.4-1.6-4.1-3.9-4.1zM13.6 5.5A3.4 3.4 0 0011 9c0 1.8 1.3 3.1 3 3.1.3 0 .5 0 .8-.1-.5 1.3-1.5 2.2-2.9 2.7l.7 1.4c2.9-.9 4.9-3.4 4.9-6.5 0-2.4-1.6-4.1-3.9-4.1z" />
    </svg>
  ),
  code: (
    <I>
      <path d="M7 6l-4 4 4 4M13 6l4 4-4 4" />
    </I>
  ),
  codeblock: (
    <I>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M8 8l-2.2 2L8 12M12 8l2.2 2L12 12" />
    </I>
  ),
  table: (
    <I>
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
      <path d="M2.5 8h15M7.5 8v8.5M12.5 8v8.5" />
    </I>
  ),
  more: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="16" cy="10" r="1.5" />
    </svg>
  ),
  image: (
    <I>
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <circle cx="7" cy="8.5" r="1.4" />
      <path d="M4 14.5l4-3.5 3 2.5 3-2.5 3.5 3" />
    </I>
  ),
} as const;

type Tool = {
  key: string;
  title: string;
  icon: React.ReactNode;
  divider?: boolean; // draw a divider before this tool
  run: (e: Editor) => void;
};

const TOOLS: Tool[] = [
  { key: "bold", title: "Bold", icon: <span className="text-[15px] font-black">B</span>, run: (e) => surround(e, "**", "**", "bold") },
  { key: "italic", title: "Italic", icon: <span className="font-serif text-[15px] italic">i</span>, run: (e) => surround(e, "*", "*", "italic") },
  { key: "strike", title: "Strikethrough", icon: <span className="text-[15px] font-semibold line-through">S</span>, run: (e) => surround(e, "~~", "~~", "text") },
  { key: "sup", title: "Superscript", icon: <span className="text-[13px] font-semibold">X²</span>, run: (e) => surround(e, "^(", ")", "sup") },
  { key: "heading", title: "Heading", icon: <span className="text-[14px] font-semibold">ᴛT</span>, run: (e) => prefixLines(e, () => "# ") },
  { key: "link", title: "Link", icon: ICONS.link, divider: true, run: (e) => surround(e, "[", "](https://)", "text") },
  { key: "ul", title: "Bullet List", icon: ICONS.ul, run: (e) => prefixLines(e, () => "- ") },
  { key: "ol", title: "Number List", icon: ICONS.ol, run: (e) => prefixLines(e, (i) => `${i + 1}. `) },
  { key: "spoiler", title: "Spoiler", icon: ICONS.spoiler, divider: true, run: (e) => surround(e, ">!", "!<", "spoiler") },
  { key: "quote", title: "Quote Block", icon: ICONS.quote, run: (e) => prefixLines(e, () => "> ") },
  { key: "code", title: "Code", icon: ICONS.code, run: (e) => surround(e, "`", "`", "code") },
  { key: "codeblock", title: "Code Block", icon: ICONS.codeblock, run: (e) => insertBlock(e, "```\ncode\n```\n") },
  { key: "table", title: "Table", icon: ICONS.table, run: (e) => insertBlock(e, "| Col A | Col B |\n| --- | --- |\n| 1 | 2 |\n") },
];

let uploadSeq = 0;

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
  autoFocus = false,
  maxLength,
  collapsed = false,
  collapsedPlaceholder = "Join the conversation",
  onExpand,
  actions,
  onUploadingChange,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  maxLength?: number;
  /** Render as Reddit's one-line pill; clicking calls onExpand. */
  collapsed?: boolean;
  collapsedPlaceholder?: string;
  onExpand?: () => void;
  /** Footer-right content (e.g. Cancel / Comment buttons). */
  actions?: React.ReactNode;
  /** Reports the number of in-flight image uploads (disable submit while > 0). */
  onUploadingChange?: (inFlight: number) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showTools, setShowTools] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const dragDepth = useRef(0);

  // Latest text for async placeholder swaps. Updated in an effect for user
  // typing AND synchronously by emit() so two uploads finishing in the same
  // React batch can't clobber each other's replacement.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const inFlight = useRef(0);

  function emit(next: string) {
    valueRef.current = next;
    onChange(next);
  }

  useEffect(() => {
    if (!collapsed && autoFocus) ref.current?.focus();
  }, [collapsed, autoFocus]);

  function bumpUploads(delta: number) {
    inFlight.current += delta;
    onUploadingChange?.(inFlight.current);
  }

  async function uploadFiles(files: File[]) {
    const images = files.filter((f) => ACCEPTED_IMAGE_TYPES.test(f.type));
    if (!images.length) {
      if (files.length) setUploadErr("Only JPEG, PNG, WebP or GIF images can go in the text.");
      return;
    }
    if (images.some((f) => f.size > MAX_IMAGE_MB * 1024 * 1024)) {
      setUploadErr(`Images are limited to ${MAX_IMAGE_MB}MB.`);
      return;
    }
    setUploadErr(null);

    // One placeholder per file, swapped for real markdown when its PUT lands.
    const batch = images.slice(0, 6).map((file) => ({
      file,
      token: `![Uploading image ${++uploadSeq}…]()`,
    }));

    const ta = ref.current;
    const caret = ta ? ta.selectionStart : valueRef.current.length;
    const before = valueRef.current.slice(0, caret);
    const after = valueRef.current.slice(caret);
    const joined = batch.map((b) => b.token).join("\n");
    const glueL = before && !before.endsWith("\n") ? "\n" : "";
    const glueR = after && !after.startsWith("\n") ? "\n" : "";
    emit(before + glueL + joined + glueR + after);

    bumpUploads(batch.length);
    try {
      const tickets = await requestUploadTickets(
        batch.map((b) => ({ content_type: b.file.type, size: b.file.size })),
      );
      await Promise.all(
        tickets.map(async (t, i) => {
          try {
            await uploadToSignedUrl(t, batch[i].file, () => {});
            emit(valueRef.current.replace(batch[i].token, `![image](${mediaPublicUrl(t.path)})`));
          } catch (e) {
            emit(valueRef.current.replace(batch[i].token, "").replace(/\n{3,}/g, "\n\n"));
            setUploadErr((e as Error).message);
          } finally {
            bumpUploads(-1);
          }
        }),
      );
    } catch (e) {
      // Ticket request itself failed — clear every placeholder.
      let next = valueRef.current;
      for (const b of batch) next = next.replace(b.token, "");
      emit(next.replace(/\n{3,}/g, "\n\n"));
      setUploadErr((e as Error).message);
      bumpUploads(-batch.length);
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="w-full rounded-full border border-line bg-transparent px-4 py-2.5 text-left text-sm text-neutral-500 transition-colors hover:border-neutral-500"
      >
        {collapsedPlaceholder}
      </button>
    );
  }

  return (
    <div
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void uploadFiles([...e.dataTransfer.files]);
      }}
      className={`relative rounded-[20px] border bg-transparent transition-colors ${
        dragging ? "border-accent ring-1 ring-accent" : "border-line focus-within:border-neutral-400"
      }`}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[20px] bg-black/60 text-sm font-bold text-neutral-100">
          Drop images or GIFs to add them
        </div>
      )}

      {showTools && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1">
          {TOOLS.map((t) => (
            <React.Fragment key={t.key}>
              {t.divider && <span className="mx-1 h-5 w-px bg-line" aria-hidden />}
              <button
                type="button"
                title={t.title}
                aria-label={t.title}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  const ta = ref.current;
                  if (ta) t.run({ value: valueRef.current, onChange: emit, ta });
                }}
                className="grid h-8 w-8 place-items-center rounded text-neutral-300 transition-colors hover:bg-white/10 hover:text-neutral-100"
              >
                {t.icon}
              </button>
            </React.Fragment>
          ))}
          <span className="relative ml-auto">
            <button
              type="button"
              title="More options"
              aria-label="More options"
              aria-expanded={showMore}
              onClick={() => setShowMore((v) => !v)}
              className="grid h-8 w-8 place-items-center rounded text-neutral-300 transition-colors hover:bg-white/10 hover:text-neutral-100"
            >
              {ICONS.more}
            </button>
            {showMore && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  tabIndex={-1}
                  onClick={() => setShowMore(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-elevated py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMore(false);
                      fileRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:bg-white/10"
                  >
                    {ICONS.image}
                    Add image
                  </button>
                </div>
              </>
            )}
          </span>
        </div>
      )}

      <textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => emit(e.target.value)}
        onPaste={(e) => {
          const files = [...e.clipboardData.files].filter((f) => ACCEPTED_IMAGE_TYPES.test(f.type));
          if (files.length) {
            e.preventDefault();
            void uploadFiles(files);
          }
        }}
        className="w-full resize-y rounded-[20px] border-0 bg-transparent px-4 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
      />

      {uploadErr && <p className="px-4 pb-1 text-xs text-mature">{uploadErr}</p>}

      <div className="flex items-center gap-2 px-2 pb-2">
        <button
          type="button"
          onClick={() => setShowTools((v) => !v)}
          aria-pressed={showTools}
          aria-label={showTools ? "Hide formatting options" : "Show formatting options"}
          title={showTools ? "Hide formatting options" : "Show formatting options"}
          className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold transition-colors ${
            showTools
              ? "bg-white/15 text-neutral-100"
              : "text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
          }`}
        >
          Aa
        </button>
        <span className="flex-1" />
        {actions}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : [];
          e.target.value = "";
          if (files.length) void uploadFiles(files);
        }}
      />
    </div>
  );
}
