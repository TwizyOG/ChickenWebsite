"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STREAMERS, CREW_STREAMERS } from "@/lib/streamers";
import { useKickMap } from "./KickProvider";
import FeaturedPlayer from "./FeaturedPlayer";
import KickChat from "./KickChat";
import StreamerCard, { CardSkeleton } from "./StreamerCard";
import StreamerDetail from "./StreamerDetail";
import type { Streamer } from "@/lib/types";

const PAGE = 9;

export default function HomeView() {
  const { live, ready } = useKickMap();
  const params = useSearchParams();
  const [manual, setManual] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(true);
  const [visible, setVisible] = useState(PAGE);
  const [detail, setDetail] = useState<Streamer | null>(null);

  // A streamer row's Watch action deep-links here as /?watch={slug}.
  const watchParam = params.get("watch");
  const watch = watchParam && STREAMERS.some((s) => s.slug === watchParam) ? watchParam : null;

  const autoFeatured = useMemo(() => {
    // ChickenAndy is always featured when live (main channel, then the RVX cam);
    // then any live RV-crew member; then the highest-viewer live channel; and a
    // default only when nobody is live — never a random non-crew stream.
    for (const slug of ["chickenandy", "chickenandytv"]) {
      if (live[slug]?.live) return slug;
    }
    const liveCrew = CREW_STREAMERS.map((c) => c.slug).filter((slug) => live[slug]?.live);
    if (liveCrew.length) {
      return liveCrew.sort((a, b) => (live[b]?.viewers ?? 0) - (live[a]?.viewers ?? 0))[0];
    }
    const liveOnes = STREAMERS.map((s) => live[s.slug]).filter((d) => d?.live);
    if (liveOnes.length) return [...liveOnes].sort((a, b) => b.viewers - a.viewers)[0].slug;
    return "wvagabond";
  }, [live]);

  const featured = manual ?? watch ?? autoFeatured;

  const liveList = useMemo(() => {
    return STREAMERS.map((s) => ({ s, d: live[s.slug] }))
      .filter((x) => x.d?.live)
      .sort((a, b) => (sortDesc ? b.d.viewers - a.d.viewers : a.d.viewers - b.d.viewers))
      .map((x) => x.s);
  }, [live, sortDesc]);

  const selectFeatured = (slug: string) => {
    setManual(slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showSkeletons = !ready && liveList.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Featured stream + live chat.
          Wide/fullscreen (xl+): chat sits beside the stream.
          Narrow: chat stacks below. Chat is height-bounded so it scrolls
          internally instead of stretching the row. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <FeaturedPlayer slug={featured} />
        <div className="mt-4 h-[460px] xl:mt-0 xl:h-[600px]">
          <KickChat slug={featured} />
        </div>
      </div>

      {/* Live streamers */}
      <div className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase">
            <span className="h-6 w-1.5 rounded-full bg-accent" />
            Live Streamers
          </h2>
          <button
            onClick={() => setSortDesc((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-elevated px-3 py-1.5 text-xs text-dim transition hover:text-ink"
          >
            <span className="text-faint">Sort by viewers</span>
            <span className="font-semibold text-ink">{sortDesc ? "↓ Highest" : "↑ Lowest"}</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showSkeletons
            ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
            : liveList.slice(0, visible).map((s) => (
                <div key={s.slug} className="rise">
                  <StreamerCard streamer={s} onSelect={selectFeatured} onInfo={setDetail} liveThumb />
                </div>
              ))}
        </div>

        {!showSkeletons && liveList.length === 0 && (
          <div className="mt-8 rounded-2xl border border-line bg-panel p-10 text-center">
            <p className="font-display text-lg font-extrabold uppercase">No one is live right now</p>
            <p className="mt-1 text-sm text-faint">
              Check back soon — streams appear here the moment a creator goes live.
            </p>
          </div>
        )}

        {visible < liveList.length && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setVisible((v) => v + PAGE)}
              className="rounded-full border border-line bg-elevated px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-dim transition hover:border-accent/50 hover:text-accent"
            >
              Load more
            </button>
          </div>
        )}
      </div>

      {detail && <StreamerDetail streamer={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
