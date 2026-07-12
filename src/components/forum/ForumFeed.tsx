"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FEED_PAGE,
  SEARCH_MAX,
  SEARCH_PAGE,
  fetchFeed,
  fetchFlairs,
  fetchMyVotes,
  fetchSearch,
  nextCursor,
  type FeedCursor,
  type FeedPost,
  type FeedSort,
  type Flair,
  type VoteValue,
} from "@/lib/forum";
import { getMe } from "@/components/forum/useMe";
import { type VoteState } from "@/components/forum/VoteRail";
import FlairBar from "@/components/forum/FlairBar";
import PostCard from "@/components/forum/PostCard";

const SORTS: FeedSort[] = ["hot", "new", "top"];
const SORT_LABEL: Record<FeedSort, string> = { hot: "Hot", new: "New", top: "Top" };

type FeedState = {
  key: string; // `${sort}|${flair}|${q}` — a key mismatch means "stale, show skeletons"
  posts: FeedPost[] | null;
  done: boolean;
  error: string | null;
};

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-faint"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.2-4.2" />
    </svg>
  );
}

/** Uncontrolled search box — debounced pushes into the ?q= URL param. */
function SearchInput({ active, onSearch }: { active: string; onSearch: (q: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="flex items-center gap-2 rounded-full border border-line px-3">
      <SearchIcon />
      <input
        ref={ref}
        defaultValue={active}
        onChange={(e) => {
          const v = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onSearch(v.trim()), 350);
        }}
        placeholder="Search posts…"
        aria-label="Search posts"
        className="w-32 bg-transparent py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 sm:w-44"
      />
      {active && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            if (ref.current) ref.current.value = "";
            onSearch("");
          }}
          className="text-sm font-bold text-neutral-500 transition-colors hover:text-neutral-200"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function ForumFeed() {
  const router = useRouter();
  const params = useSearchParams();
  const rawSort = params.get("sort") as FeedSort | null;
  const sort: FeedSort = rawSort && SORTS.includes(rawSort) ? rawSort : "hot";
  const flairParam = params.get("flair");
  const flair = flairParam ? Number(flairParam) || null : null;
  const q = (params.get("q") ?? "").trim();
  const key = `${sort}|${flair ?? ""}|${q}`;

  const [flairs, setFlairs] = useState<Flair[]>([]);
  // Reset-on-filter-change is *derived* from the key (no setState in effects):
  // state tagged with a stale key renders as if it were the fresh empty state.
  const [feed, setFeed] = useState<FeedState>({ key, posts: null, done: false, error: null });
  const [voteState, setVoteState] = useState<Record<string, VoteState>>({});
  const shown: FeedState =
    feed.key === key ? feed : { key, posts: null, done: false, error: null };
  const cursor = useRef<FeedCursor>(null);
  const offset = useRef(0);
  const loading = useRef(false);
  const rerun = useRef(false);
  const loadMoreRef = useRef<(reset: boolean) => void>(() => {});
  const sentinel = useRef<HTMLDivElement | null>(null);

  const setQuery = (nextSort: FeedSort, nextFlair: number | null, nextQ: string) => {
    const p = new URLSearchParams();
    if (nextSort !== "hot") p.set("sort", nextSort);
    if (nextFlair != null) p.set("flair", String(nextFlair));
    if (nextQ) p.set("q", nextQ);
    router.replace(`/community${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  const loadMore = useCallback(
    async (reset: boolean) => {
      if (loading.current) {
        if (reset) rerun.current = true; // queue a fresh load for the latest key
        return;
      }
      loading.current = true;
      try {
        let page: FeedPost[];
        let done: boolean;
        if (q) {
          const from = reset ? 0 : offset.current;
          page = await fetchSearch(q, flair, from);
          offset.current = from + page.length;
          done = page.length < SEARCH_PAGE || offset.current >= SEARCH_MAX;
        } else {
          page = await fetchFeed(sort, flair, reset ? null : cursor.current);
          cursor.current = nextCursor(sort, page);
          done = page.length < FEED_PAGE;
        }
        setFeed((prev) => {
          const base = !reset && prev.key === key && prev.posts ? prev.posts : [];
          return { key, posts: [...base, ...page], done, error: null };
        });
        // hydrate the caller's votes for this page (no-op signed out / on the mirror)
        const meRes = await getMe();
        if (!("signedOut" in meRes) && page.length) {
          const mine = await fetchMyVotes("post", page.map((p) => p.id));
          setVoteState((prev) => {
            const next = { ...prev };
            for (const p of page) {
              if (!next[p.id]) {
                next[p.id] = { score: p.score, myVote: (mine[p.id] ?? 0) as VoteValue };
              }
            }
            return next;
          });
        }
      } catch (e) {
        setFeed((prev) => ({
          key,
          posts: prev.key === key ? prev.posts : null,
          done: false,
          error: (e as Error).message,
        }));
      } finally {
        loading.current = false;
        if (rerun.current) {
          rerun.current = false;
          loadMoreRef.current(true); // re-fetch for the current key via the freshest closure
        }
      }
    },
    [sort, flair, q, key],
  );

  // Let the finally-block retry reach the freshest loadMore, so a load queued
  // (rerun) while another was in flight re-fetches for the CURRENT key.
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);

  useEffect(() => {
    cursor.current = null;
    offset.current = 0;
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
        {!q && (
          <div className="flex rounded-full border border-line p-0.5">
            {SORTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s, flair, q)}
                className={`rounded-full px-3.5 py-1 text-sm font-semibold transition-colors ${
                  s === sort ? "bg-accent text-accent-ink" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {SORT_LABEL[s]}
              </button>
            ))}
          </div>
        )}
        <SearchInput active={q} onSearch={(nq) => setQuery(sort, flair, nq)} />
        <div className="min-w-0 flex-1">
          <FlairBar flairs={flairs} active={flair} onPick={(id) => setQuery(sort, id, q)} />
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

        {shown.posts?.map((p) => {
          const vs = voteState[p.id];
          return (
            <PostCard
              key={p.id}
              post={vs ? { ...p, score: vs.score } : p}
              myVote={vs?.myVote ?? 0}
              onVote={(next) => setVoteState((prev) => ({ ...prev, [p.id]: next }))}
              onModRemoved={() =>
                setFeed((prev) =>
                  prev.key === key
                    ? { ...prev, posts: (prev.posts ?? []).filter((x) => x.id !== p.id) }
                    : prev,
                )
              }
            />
          );
        })}

        {shown.posts !== null && shown.posts.length === 0 && !shown.error && (
          <div className="rounded-xl border border-line bg-panel p-10 text-center text-neutral-500">
            {q
              ? `No posts match “${q}”.`
              : `No posts ${flair != null ? "with this flair " : ""}yet — be the first!`}
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
