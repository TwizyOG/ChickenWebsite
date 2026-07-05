"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FEED_PAGE,
  fetchFeed,
  fetchFlairs,
  nextCursor,
  type FeedCursor,
  type FeedPost,
  type FeedSort,
  type Flair,
} from "@/lib/forum";
import FlairBar from "@/components/forum/FlairBar";
import PostCard from "@/components/forum/PostCard";

const SORTS: FeedSort[] = ["hot", "new", "top"];
const SORT_LABEL: Record<FeedSort, string> = { hot: "Hot", new: "New", top: "Top" };

type FeedState = {
  key: string; // `${sort}|${flair}` — a key mismatch means "stale, show skeletons"
  posts: FeedPost[] | null;
  done: boolean;
  error: string | null;
};

export default function ForumFeed() {
  const router = useRouter();
  const params = useSearchParams();
  const rawSort = params.get("sort") as FeedSort | null;
  const sort: FeedSort = rawSort && SORTS.includes(rawSort) ? rawSort : "hot";
  const flairParam = params.get("flair");
  const flair = flairParam ? Number(flairParam) || null : null;
  const key = `${sort}|${flair ?? ""}`;

  const [flairs, setFlairs] = useState<Flair[]>([]);
  // Reset-on-filter-change is *derived* from the key (no setState in effects):
  // state tagged with a stale key renders as if it were the fresh empty state.
  const [feed, setFeed] = useState<FeedState>({ key, posts: null, done: false, error: null });
  const shown: FeedState =
    feed.key === key ? feed : { key, posts: null, done: false, error: null };
  const cursor = useRef<FeedCursor>(null);
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const setQuery = (nextSort: FeedSort, nextFlair: number | null) => {
    const q = new URLSearchParams();
    if (nextSort !== "hot") q.set("sort", nextSort);
    if (nextFlair != null) q.set("flair", String(nextFlair));
    router.replace(`/community${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const loadMore = useCallback(
    async (reset: boolean) => {
      if (loading.current) return;
      loading.current = true;
      try {
        const page = await fetchFeed(sort, flair, reset ? null : cursor.current);
        cursor.current = nextCursor(sort, page);
        setFeed((prev) => {
          const base = !reset && prev.key === key && prev.posts ? prev.posts : [];
          return { key, posts: [...base, ...page], done: page.length < FEED_PAGE, error: null };
        });
      } catch (e) {
        setFeed((prev) => ({
          key,
          posts: prev.key === key ? prev.posts : null,
          done: false,
          error: (e as Error).message,
        }));
      } finally {
        loading.current = false;
      }
    },
    [sort, flair, key],
  );

  useEffect(() => {
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);

  useEffect(() => {
    cursor.current = null;
    loadMore(true);
  }, [loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown.done || shown.error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore(false);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, shown.done, shown.error, shown.posts?.length]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-line p-0.5">
          {SORTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuery(s, flair)}
              className={`rounded-full px-3.5 py-1 text-sm font-semibold transition-colors ${
                s === sort ? "bg-accent text-accent-ink" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {SORT_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <FlairBar flairs={flairs} active={flair} onPick={(id) => setQuery(sort, id)} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {shown.posts === null &&
          !shown.error &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-panel" />
          ))}

        {shown.error && (
          <div className="rounded-xl border border-line bg-panel p-6 text-center">
            <p className="text-sm text-neutral-400">Couldn&apos;t load the feed: {shown.error}</p>
            <button
              type="button"
              onClick={() => loadMore(shown.posts === null)}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
            >
              Try again
            </button>
          </div>
        )}

        {shown.posts?.map((p) => <PostCard key={p.id} post={p} />)}

        {shown.posts !== null && shown.posts.length === 0 && !shown.error && (
          <div className="rounded-xl border border-line bg-panel p-10 text-center text-neutral-500">
            No posts {flair != null ? "with this flair " : ""}yet — be the first!
          </div>
        )}

        {shown.done && shown.posts !== null && shown.posts.length > 0 && (
          <p className="py-4 text-center text-xs text-neutral-600">You&apos;re all caught up.</p>
        )}
        <div ref={sentinel} />
      </div>
    </div>
  );
}
