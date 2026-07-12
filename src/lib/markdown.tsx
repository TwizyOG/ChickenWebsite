"use client";

import React, { useState } from "react";

/* Reddit-style markdown → React elements. Security by construction: user text
   only ever becomes React text children (React escapes it) — we never use
   dangerouslySetInnerHTML — and link hrefs are scheme-checked. Supports bold,
   italic, strikethrough, superscript, inline code, links, spoilers, headings,
   quotes, bullet/ordered lists, code blocks and tables. */

const HREF_OK = /^(https?:\/\/|mailto:|\/|#)/i;
function safeHref(url: string): string {
  const u = url.trim();
  return HREF_OK.test(u) ? u : "#";
}

/* ------------------------------------------------------------------ inline */

function Spoiler({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setShown(true)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShown(true)}
      className={
        shown
          ? "rounded bg-white/10 px-0.5"
          : "cursor-pointer select-none rounded bg-neutral-700 px-0.5 text-transparent"
      }
      title={shown ? undefined : "Reveal spoiler"}
    >
      {children}
    </span>
  );
}

type InlineRule = {
  re: RegExp;
  node: (m: RegExpExecArray, rec: (s: string) => React.ReactNode[]) => React.ReactNode;
};

// Ordered by priority; on an index tie the earlier rule wins.
const INLINE: InlineRule[] = [
  { re: /`([^`]+)`/, node: (m) => <code className="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">{m[1]}</code> },
  { re: /\[([^\]]+)\]\(([^)\s]+)\)/, node: (m, rec) => (
      <a href={safeHref(m[2])} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
        {rec(m[1])}
      </a>
    ) },
  { re: />!([\s\S]+?)!</, node: (m, rec) => <Spoiler>{rec(m[1])}</Spoiler> },
  { re: /\*\*([\s\S]+?)\*\*/, node: (m, rec) => <strong>{rec(m[1])}</strong> },
  { re: /~~([\s\S]+?)~~/, node: (m, rec) => <del>{rec(m[1])}</del> },
  { re: /\*([^*\n]+?)\*/, node: (m, rec) => <em>{rec(m[1])}</em> },
  { re: /_([^_\n]+?)_/, node: (m, rec) => <em>{rec(m[1])}</em> },
  { re: /\^\(([^)]+)\)/, node: (m, rec) => <sup>{rec(m[1])}</sup> },
  { re: /\^(\S+)/, node: (m, rec) => <sup>{rec(m[1])}</sup> },
];

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let guard = 0;
  while (rest && guard++ < 500) {
    let best: { idx: number; rule: InlineRule; m: RegExpExecArray } | null = null;
    for (const rule of INLINE) {
      const m = rule.re.exec(rest);
      if (m && (best === null || m.index < best.idx)) best = { idx: m.index, rule, m };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    out.push(<React.Fragment key={out.length}>{best.rule.node(best.m, renderInline)}</React.Fragment>);
    rest = rest.slice(best.idx + best.m[0].length);
  }
  return out;
}

/** Inline text with hard line breaks preserved. */
function renderInlineMultiline(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.flatMap((ln, i) => [
    <React.Fragment key={`l${i}`}>{renderInline(ln)}</React.Fragment>,
    ...(i < lines.length - 1 ? [<br key={`br${i}`} />] : []),
  ]);
}

/* ------------------------------------------------------------------- blocks */

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const splitRow = (l: string) =>
  l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

function renderBlocks(src: string, keyBase = "b"): React.ReactNode[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  const key = () => `${keyBase}${out.length}`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // fenced code block
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++; // closing fence
      out.push(
        <pre key={key()} className="my-2 overflow-x-auto rounded-lg border border-line bg-black/40 p-3 text-xs">
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // table: header row + separator
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i++]));
      }
      out.push(
        <div key={key()} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th key={hi} className="border border-line px-2 py-1 text-left font-bold">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((cell, ci) => (
                    <td key={ci} className="border border-line px-2 py-1">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // blockquote
    if (/^>\s?(?!!)/.test(line) || line.trim() === ">") {
      const inner: string[] = [];
      while (i < lines.length && /^>/.test(lines[i]) && !/^>!/.test(lines[i])) {
        inner.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        <blockquote key={key()} className="my-2 border-l-2 border-neutral-600 pl-3 text-neutral-400">
          {renderBlocks(inner.join("\n"), `${keyBase}q`)}
        </blockquote>,
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const sizes = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm", "text-sm"];
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      out.push(
        <Tag key={key()} className={`mt-3 mb-1 font-bold text-neutral-100 ${sizes[level - 1]}`}>
          {renderInline(h[2])}
        </Tag>,
      );
      i++;
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push(<hr key={key()} className="my-3 border-line" />);
      i++;
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key()} className="my-2 list-disc space-y-0.5 pl-5">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        <ol key={key()} className="my-2 list-decimal space-y-0.5 pl-5">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // paragraph: gather until blank or a new block starts
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^>\s?(?!!)/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key()} className="my-1.5 whitespace-pre-wrap break-words">
        {renderInlineMultiline(para.join("\n"))}
      </p>,
    );
  }

  return out;
}

export function Markdown({ text, className }: { text: string | null; className?: string }) {
  if (!text || !text.trim()) return null;
  return <div className={`markdown-body ${className ?? ""}`}>{renderBlocks(text)}</div>;
}

// Exported for unit tests.
export const _internal = { safeHref, renderInline, renderBlocks };
