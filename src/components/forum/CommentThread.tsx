"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTree,
  fetchMyVotes,
  fetchThread,
  filterTree,
  sortTree,
  THREAD_SORTS,
  type ThreadComment,
  type ThreadSort,
  type VoteValue,
} from "@/lib/forum";
import { getMe, useMe } from "@/components/forum/useMe";
import { type VoteState } from "@/components/forum/VoteRail";
import CommentComposer from "@/components/forum/CommentComposer";
import CommentNode, { type ThreadHandlers } from "@/components/forum/CommentNode";

type ThreadState = { key: string; rows: ThreadComment[] | null; error: string | null };

/* Small original glyphs for the sort menu rows (16×16, currentColor). */
const SORT_ICONS: Record<ThreadSort, React.ReactNode> = {
  best: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="6" r="3.5" />
      <path d="M5.8 8.8L4.5 14l3.5-2 3.5 2-1.3-5.2" />
    </svg>
  ),
  top: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 11l4-4 3 3 5-5" />
      <path d="M10.5 5H14v3.5" />
    </svg>
  ),
  new: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  ),
  controversial: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8.5 1.5L3 9h4l-1.5 5.5L11 7H7z" />
    </svg>
  ),
  old: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 1.5h8M4 14.5h8M5 1.5v3l3 3.5 3-3.5v-3M5 14.5v-3L8 8l3 3.5v3" />
    </svg>
  ),
  qa: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 3.5h8v6H5L2.5 12V3.5z" />
      <path d="M11.5 6H14v6.5L12 11h-4" />
    </svg>
  ),
};

function SortDropdown({ sort, onChange }: { sort: ThreadSort; onChange: (s: ThreadSort) => void }) {
  const [open, setOpen] = useState(false);
  const current = THREAD_SORTS.find((s) => s.key === sort)!;
  return (
    <div className="relative flex items-center gap-1.5 text-xs">
      <span className="text-neutral-500">Sort by:</span>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sort by ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-neutral-300 transition-colors hover:bg-white/10 hover:text-neutral-100"
      >
        {current.label}
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close sort menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-elevated py-1 shadow-xl"
          >
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              Sort by
            </p>
            {THREAD_SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(s.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm font-semibold transition-colors ${
                  s.key === sort
                    ? "bg-white/10 text-neutral-100"
                    : "text-neutral-300 hover:bg-white/5 hover:text-neutral-100"
                }`}
              >
                {SORT_ICONS[s.key]}
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CommentSearch({ q, onChange }: { q: string; onChange: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  if (!open) {
    return (
      <button
        type="button"
        aria-label="Search Comments"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        Search Comments
      </button>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line px-3 py-1.5 focus-within:border-accent sm:max-w-64">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search Comments"
        className="min-w-0 flex-1 bg-transparent text-xs text-neutral-100 outline-none placeholder:text-neutral-600"
      />
      <button
        type="button"
        aria-label="Clear comment search"
        onClick={() => {
          onChange("");
          setOpen(false);
        }}
        className="text-xs font-bold text-neutral-500 transition-colors hover:text-neutral-200"
      >
        ✕
      </button>
    </div>
  );
}

export default function CommentThread({
  postId,
  postAuthorKickId = null,
  refreshKey = 0,
  onCountChange,
}: {
  postId: string;
  postAuthorKickId?: number | null;
  refreshKey?: number;
  onCountChange?: (delta: number) => void;
}) {
  const me = useMe();
  const [state, setState] = useState<ThreadState>({ key: postId, rows: null, error: null });
  const [sort, setSort] = useState<ThreadSort>("best");
  const [search, setSearch] = useState("");
  const [voteState, setVoteState] = useState<Record<string, VoteState>>({});
  const shown: ThreadState = state.key === postId ? state : { key: postId, rows: null, error: null };

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const rows = await fetchThread(postId);
        if (stale) return;
        setState({ key: postId, rows, error: null });
        const meRes = await getMe();
        if (stale || "signedOut" in meRes || !rows.length) return;
        const mine = await fetchMyVotes("comment", rows.map((r) => r.id));
        if (stale) return;
        setVoteState((prev) => {
          const next = { ...prev };
          for (const r of rows) {
            if (!next[r.id]) next[r.id] = { score: r.score, myVote: (mine[r.id] ?? 0) as VoteValue };
          }
          return next;
        });
      } catch (e) {
        if (!stale) setState({ key: postId, rows: null, error: (e as Error).message });
      }
    })();
    return () => {
      stale = true;
    };
  }, [postId, refreshKey]);

  // Deep-link (#c-{id} from bell links): scroll once the thread has rendered.
  const loaded = shown.rows !== null;
  useEffect(() => {
    if (!loaded) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#c-")) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [loaded]);

  const tree = useMemo(
    () =>
      shown.rows
        ? filterTree(sortTree(buildTree(shown.rows), sort, postAuthorKickId), search)
        : [],
    [shown.rows, sort, search, postAuthorKickId],
  );

  const handlers: ThreadHandlers = {
    postId,
    myKickId: me && !("signedOut" in me) ? me.profile.kickId : null,
    myRole: me && !("signedOut" in me) ? me.profile.role : null,
    voteState,
    onVote: (id, next) => setVoteState((prev) => ({ ...prev, [id]: next })),
    onReplyDone: (row) => {
      setState((prev) => ({ ...prev, rows: [...(prev.rows ?? []), row] }));
      // The author implicitly upvoted their own comment (server starts it at 1).
      setVoteState((prev) => ({ ...prev, [row.id]: { score: row.score, myVote: 1 } }));
      onCountChange?.(1);
    },
    onEdited: (row) =>
      setState((prev) => ({
        ...prev,
        rows: (prev.rows ?? []).map((r) => (r.id === row.id ? row : r)),
      })),
    onDeleted: (id) =>
      setState((prev) => ({
        ...prev,
        rows: (prev.rows ?? []).map((r) =>
          r.id === id
            ? {
                ...r,
                removed: true,
                body: null,
                gif_url: null,
                author_username: null,
                author_avatar: null,
                author_role: null,
                author_kick_id: null,
              }
            : r,
        ),
      })),
    onPurged: (id) => {
      setState((prev) => ({
        ...prev,
        rows: (prev.rows ?? []).filter((r) => r.id !== id),
      }));
      onCountChange?.(-1);
    },
  };

  const searching = search.trim().length > 0;

  return (
    <div className="mt-4 rounded-xl border border-line bg-panel p-4">
      <h3 className="text-sm font-bold text-neutral-200">
        {shown.rows
          ? `${shown.rows.length} comment${shown.rows.length === 1 ? "" : "s"}`
          : "Comments"}
      </h3>

      <div className="mt-3">
        <CommentComposer postId={postId} onDone={handlers.onReplyDone} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SortDropdown sort={sort} onChange={setSort} />
        <CommentSearch q={search} onChange={setSearch} />
      </div>

      {shown.rows === null && !shown.error && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      )}
      {shown.error && (
        <p className="mt-4 text-sm text-neutral-500">Couldn&apos;t load comments: {shown.error}</p>
      )}
      {shown.rows !== null && shown.rows.length === 0 && (
        <p className="mt-6 text-center text-sm text-neutral-600">No comments yet — say something!</p>
      )}
      {shown.rows !== null && shown.rows.length > 0 && searching && tree.length === 0 && (
        <p className="mt-6 text-center text-sm text-neutral-600">
          No comments match &ldquo;{search.trim()}&rdquo;.
        </p>
      )}
      <div>
        {tree.map((node) => (
          <CommentNode key={node.comment.id} node={node} h={handlers} />
        ))}
      </div>
    </div>
  );
}
