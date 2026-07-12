"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deletePost,
  fetchMyVotes,
  fetchPost,
  updatePost,
  type FeedPost,
  type VoteValue,
} from "@/lib/forum";
import { getMe, useMe } from "@/components/forum/useMe";
import { type VoteState } from "@/components/forum/VoteRail";
import PostCard from "@/components/forum/PostCard";
import CommentThread from "@/components/forum/CommentThread";
import { useLiveChannel } from "@/lib/forumLive";

export default function PostView() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const me = useMe();
  // Tagged with the id it belongs to, so a stale result never leaks between posts.
  const [result, setResult] = useState<{ id: string; post: FeedPost | null } | null>(null);
  const [vote, setVote] = useState<{ id: string; state: VoteState } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let stale = false;
    (async () => {
      try {
        const p = await fetchPost(id);
        if (stale) return;
        setResult({ id, post: p });
        if (!p) return;
        const meRes = await getMe();
        if (stale || "signedOut" in meRes) return;
        const mine = await fetchMyVotes("post", [id]);
        if (!stale) {
          setVote({ id, state: { score: p.score, myVote: (mine[id] ?? 0) as VoteValue } });
        }
      } catch {
        if (!stale) setResult({ id, post: null });
      }
    })();
    return () => {
      stale = true;
    };
  }, [id]);

  const [liveNonce, setLiveNonce] = useState(0);
  useLiveChannel(id ? `post:${id}` : null, ["comments", "votes", "removed"], () => {
    if (!id) return;
    fetchPost(id)
      .then((p) => {
        setResult((prev) => (prev && prev.id === id ? { id, post: p } : prev));
        if (p) {
          setVote((prev) =>
            prev && prev.id === id ? { id, state: { ...prev.state, score: p.score } } : prev,
          );
          setLiveNonce((x) => x + 1);
        }
      })
      .catch(() => {});
  });

  // no id → missing; wrong/absent result → still loading; loaded null → missing
  const post: FeedPost | null | "missing" = !id
    ? "missing"
    : result?.id === id
      ? (result.post ?? "missing")
      : null;

  if (post === null) {
    return <div className="h-48 animate-pulse rounded-xl border border-line bg-panel" />;
  }

  if (post === "missing") {
    return (
      <div className="rounded-xl border border-line bg-panel p-10 text-center">
        <p className="font-bold text-neutral-200">This post doesn&apos;t exist (or was removed).</p>
        <Link
          href="/community"
          className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
        >
          Back to the community feed
        </Link>
      </div>
    );
  }

  const vs: VoteState =
    vote?.id === post.id ? vote.state : { score: post.score, myVote: 0 as VoteValue };
  const mine = me != null && !("signedOut" in me) && me.profile.kickId === post.author_kick_id;

  async function saveEdit() {
    if (busy || post === null || post === "missing") return;
    setBusy(true);
    try {
      await updatePost(post.id, draft.trim());
      setResult((prev) =>
        prev?.post
          ? {
              ...prev,
              post: { ...prev.post, body: draft.trim() || null, edited_at: new Date().toISOString() },
            }
          : prev,
      );
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function removePost() {
    if (busy || post === null || post === "missing") return;
    if (!window.confirm("Delete this post?")) return;
    setBusy(true);
    try {
      await deletePost(post.id);
      router.push("/community");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PostCard
        post={{ ...post, score: vs.score }}
        full
        myVote={vs.myVote}
        onVote={(next) => setVote({ id: post.id, state: next })}
        onModRemoved={() => router.push("/community")}
      />

      {mine && !editing && (
        <div className="mt-2 flex justify-end gap-3 text-xs font-semibold text-neutral-500">
          <button
            type="button"
            onClick={() => {
              setDraft(post.body ?? "");
              setEditing(true);
            }}
            className="transition-colors hover:text-neutral-300"
          >
            Edit post
          </button>
          <button type="button" onClick={removePost} className="transition-colors hover:text-mature">
            Delete post
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-2 rounded-xl border border-line bg-panel p-3">
          <textarea
            value={draft}
            maxLength={10000}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent"
          />
          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-semibold text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={saveEdit}
              className="rounded bg-accent px-3 py-1 text-xs font-bold text-accent-ink disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <CommentThread
        postId={post.id}
        refreshKey={liveNonce}
        onCountChange={(d) =>
          setResult((prev) =>
            prev?.post
              ? { ...prev, post: { ...prev.post, comment_count: prev.post.comment_count + d } }
              : prev,
          )
        }
      />
    </div>
  );
}
