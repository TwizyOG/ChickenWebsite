"use client";

import { useState } from "react";
import Link from "next/link";
import { banUser, modRemove, type FeedPost, type VoteValue, timeAgo } from "@/lib/forum";
import VoteRail, { type VoteState } from "@/components/forum/VoteRail";
import MediaViewer from "@/components/forum/MediaViewer";
import UserHovercard from "@/components/forum/UserHovercard";
import { useMe } from "@/components/forum/useMe";
import ReportDialog from "@/components/forum/ReportDialog";

export function FlairChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {name}
    </span>
  );
}

/** One feed/detail card. `full` = detail page (no clamp, title not a link).
    Parents own vote state: pass score inside `post`, plus myVote/onVote. */
export default function PostCard({
  post,
  full = false,
  myVote = 0,
  onVote,
  onModRemoved,
}: {
  post: FeedPost;
  full?: boolean;
  myVote?: VoteValue;
  onVote?: (next: VoteState) => void;
  onModRemoved?: () => void;
}) {
  const me = useMe();
  const href = `/community/post?id=${post.id}`;
  const isMod = me != null && !("signedOut" in me) && me.profile.role !== "user";
  const own = me != null && !("signedOut" in me) && me.profile.kickId === post.author_kick_id;
  const [reporting, setReporting] = useState(false);

  async function modRemovePost() {
    const reason = window.prompt("Removal reason:");
    if (reason == null) return;
    try {
      await modRemove("post", post.id, reason.trim());
      onModRemoved?.();
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function banAuthor() {
    const reason = window.prompt(`Ban u/${post.author_username} — reason:`);
    if (reason == null) return;
    const daysRaw = window.prompt("Ban length in days (blank = permanent):", "");
    if (daysRaw == null) return;
    const days = daysRaw.trim() ? Number(daysRaw) : null;
    try {
      await banUser(post.author_kick_id, reason.trim(), Number.isFinite(days ?? NaN) ? days : null);
      window.alert(`u/${post.author_username} is banned.`);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }
  const title = (
    <h2 className={`font-bold leading-snug text-neutral-100 ${full ? "text-xl" : "text-base"}`}>
      {post.title}
    </h2>
  );
  return (
    <article className="flex gap-3 rounded-xl border border-line bg-panel p-3 transition-colors hover:border-neutral-600">
      <VoteRail
        type="post"
        id={post.id}
        score={post.score}
        myVote={myVote}
        onChange={(n) => onVote?.(n)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <FlairChip name={post.flair_name} color={post.flair_color} />
          <UserHovercard username={post.author_username} kickId={post.author_kick_id}>
            <span className="font-semibold text-neutral-300">u/{post.author_username}</span>
          </UserHovercard>
          <span>·</span>
          <span>{timeAgo(post.created_at)} ago</span>
          {post.edited_at && <span className="italic">(edited)</span>}
        </div>
        {full ? (
          <div className="mt-1.5">{title}</div>
        ) : (
          <Link href={href} className="mt-1.5 block">
            {title}
          </Link>
        )}
        <MediaViewer attachments={post.attachments} />
        {post.body && (full || !post.attachments?.length) && (
          <p
            className={`mt-1.5 whitespace-pre-wrap text-sm text-neutral-400 ${full ? "" : "line-clamp-3"}`}
          >
            {post.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-neutral-500">
          <Link href={href} className="flex items-center gap-1.5 transition-colors hover:text-neutral-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M21 12a8 8 0 01-8 8H4l2-3a8 8 0 1115-5z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {post.comment_count} comments
          </Link>
          {!own && (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="transition-colors hover:text-neutral-300"
            >
              Report
            </button>
          )}
          {isMod && !own && (
            <>
              <button type="button" onClick={modRemovePost} className="transition-colors hover:text-mature">
                Remove
              </button>
              <button type="button" onClick={banAuthor} className="transition-colors hover:text-mature">
                Ban
              </button>
            </>
          )}
        </div>
      </div>
      {reporting && (
        <ReportDialog type="post" id={post.id} onClose={() => setReporting(false)} />
      )}
    </article>
  );
}
