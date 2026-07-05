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

export default function ForumFeed() {
  const router = useRouter();
  const params = useSearchParams();
  const rawSort = params.get("sort") as FeedSort | null;
  const sort: FeedSort = rawSort && SORTS.includes(rawSort) ? rawSort : "hot";
  const flairParam = params.get("flair");
  const flair = flairParam ? Number(flairParam) || null : null;

  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [posts, setPosts] = useState<FeedPost[] | null>(null); // null = first load
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
      setError(null);
      try {
        const page = await fetchFeed(sort, flair, reset ? null : cursor.current);
        cursor.current = nextCursor(sort, page);
        setPosts((prev) => (reset || !prev ? page : [...prev, ...page]));
        if (page.length < FEED_PAGE) setDone(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        loading.current = false;
      }
    },
    [sort, flair],
  );

  useEffect(() => {
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);

  useEffect(() => {
    cursor.current = null;
    setPosts(null);
    setDone(false);
    loadMore(true);
  }, [loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore(false);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done, posts?.length]);

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
        {posts === null &&
          !error &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-panel" />
          ))}

        {error && (
          <div className="rounded-xl border border-line bg-panel p-6 text-center">
            <p className="text-sm text-neutral-400">Couldn&apos;t load the feed: {error}</p>
            <button
              type="button"
              onClick={() => loadMore(posts === null)}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
            >
              Try again
            </button>
          </div>
        )}

        {posts?.map((p) => <PostCard key={p.id} post={p} />)}

        {posts !== null && posts.length === 0 && !error && (
          <div className="rounded-xl border border-line bg-panel p-10 text-center text-neutral-500">
            No posts {flair != null ? "with this flair " : ""}yet — be the first!
          </div>
        )}

        {done && posts !== null && posts.length > 0 && (
          <p className="py-4 text-center text-xs text-neutral-600">You&apos;re all caught up.</p>
        )}
        <div ref={sentinel} />
      </div>
    </div>
  );
}
