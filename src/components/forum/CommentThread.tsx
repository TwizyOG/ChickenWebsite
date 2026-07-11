"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildTree,
  fetchMyVotes,
  fetchThread,
  sortTree,
  type ThreadComment,
  type ThreadSort,
  type VoteValue,
} from "@/lib/forum";
import { getMe, useMe } from "@/components/forum/useMe";
import { type VoteState } from "@/components/forum/VoteRail";
import CommentComposer from "@/components/forum/CommentComposer";
import CommentNode, { type ThreadHandlers } from "@/components/forum/CommentNode";

type ThreadState = { key: string; rows: ThreadComment[] | null; error: string | null };

export default function CommentThread({
  postId,
  onCountChange,
}: {
  postId: string;
  onCountChange?: (delta: number) => void;
}) {
  const me = useMe();
  const [state, setState] = useState<ThreadState>({ key: postId, rows: null, error: null });
  const [sort, setSort] = useState<ThreadSort>("top");
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
  }, [postId]);

  // Deep-link (#c-{id} from bell links): scroll once the thread has rendered.
  const loaded = shown.rows !== null;
  useEffect(() => {
    if (!loaded) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#c-")) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [loaded]);

  const tree = useMemo(
    () => (shown.rows ? sortTree(buildTree(shown.rows), sort) : []),
    [shown.rows, sort],
  );

  const handlers: ThreadHandlers = {
    postId,
    myKickId: me && !("signedOut" in me) ? me.profile.kickId : null,
    myRole: me && !("signedOut" in me) ? me.profile.role : null,
    voteState,
    onVote: (id, next) => setVoteState((prev) => ({ ...prev, [id]: next })),
    onReplyDone: (row) => {
      setState((prev) => ({ ...prev, rows: [...(prev.rows ?? []), row] }));
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
  };

  return (
    <div className="mt-4 rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-neutral-200">
          {shown.rows
            ? `${shown.rows.length} comment${shown.rows.length === 1 ? "" : "s"}`
            : "Comments"}
        </h3>
        <div className="flex rounded-full border border-line p-0.5 text-xs font-semibold">
          {(["top", "new"] as ThreadSort[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`rounded-full px-2.5 py-0.5 transition-colors ${
                s === sort ? "bg-accent text-accent-ink" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {s === "top" ? "Top" : "New"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <CommentComposer postId={postId} onDone={handlers.onReplyDone} />
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
      <div>
        {tree.map((node) => (
          <CommentNode key={node.comment.id} node={node} h={handlers} />
        ))}
      </div>
    </div>
  );
}
