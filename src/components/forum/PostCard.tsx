"use client";

import Link from "next/link";
import { type FeedPost, timeAgo } from "@/lib/forum";

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
    The static score rail becomes the interactive VoteRail in plan 02. */
export default function PostCard({ post, full = false }: { post: FeedPost; full?: boolean }) {
  const href = `/community/post?id=${post.id}`;
  const title = (
    <h2 className={`font-bold leading-snug text-neutral-100 ${full ? "text-xl" : "text-base"}`}>
      {post.title}
    </h2>
  );
  return (
    <article className="flex gap-3 rounded-xl border border-line bg-panel p-3 transition-colors hover:border-neutral-600">
      <div className="flex w-10 shrink-0 flex-col items-center gap-1 pt-1 text-neutral-400">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5l7 8h-4v6h-6v-6H5z" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-bold text-neutral-200">{post.score}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 rotate-180" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5l7 8h-4v6h-6v-6H5z" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <FlairChip name={post.flair_name} color={post.flair_color} />
          <span className="font-semibold text-neutral-300">u/{post.author_username}</span>
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
        {post.body && (
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
        </div>
      </div>
    </article>
  );
}
