"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchPost, type FeedPost } from "@/lib/forum";
import PostCard from "@/components/forum/PostCard";

export default function PostView() {
  const id = useSearchParams().get("id");
  // Tagged with the id it belongs to, so a stale result never leaks between posts.
  const [result, setResult] = useState<{ id: string; post: FeedPost | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    let stale = false;
    fetchPost(id)
      .then((p) => {
        if (!stale) setResult({ id, post: p });
      })
      .catch(() => {
        if (!stale) setResult({ id, post: null });
      });
    return () => {
      stale = true;
    };
  }, [id]);

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

  return (
    <div>
      <PostCard post={post} full />
      {/* Threaded comments arrive in plan 02 (comments + votes). */}
      <div className="mt-4 rounded-xl border border-line bg-panel p-8 text-center text-sm text-neutral-500">
        Comments are coming in the next update.
      </div>
    </div>
  );
}
