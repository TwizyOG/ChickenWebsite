"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STREAMERS, CREW_STREAMERS, TOTAL_STREAMERS } from "@/lib/streamers";
import { useKickMap } from "./KickProvider";
import StreamerCard, { CardSkeleton } from "./StreamerCard";
import type { Streamer } from "@/lib/types";

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-xl font-extrabold uppercase sm:text-2xl">
      <span className="h-6 w-1.5 rounded-full bg-accent" />
      {children}
      {count != null && <span className="text-base font-semibold text-faint">{count}</span>}
    </h2>
  );
}

const OFFLINE_PREVIEW = 15;

export default function StreamersView() {
  const params = useSearchParams();
  const [localQ, setLocalQ] = useState("");
  const { live, ready } = useKickMap();
  const [showAllOffline, setShowAllOffline] = useState(false);

  const q = (params.get("q") ?? localQ).toLowerCase().trim();
  const match = (s: Streamer) =>
    !q || s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);

  const { crew, liveList, offlineList } = useMemo(() => {
    const filtered = STREAMERS.filter(match);
    const crewSlugs = new Set(CREW_STREAMERS.map((c) => c.slug));
    const liveList = filtered
      .filter((s) => live[s.slug]?.live && !crewSlugs.has(s.slug))
      .sort((a, b) => (live[b.slug]?.viewers ?? 0) - (live[a.slug]?.viewers ?? 0));
    const offlineList = filtered.filter(
      (s) => !live[s.slug]?.live && !crewSlugs.has(s.slug),
    );
    const crew = CREW_STREAMERS.filter(match);
    return { crew, liveList, offlineList };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, q]);

  const offlineShown = showAllOffline ? offlineList : offlineList.slice(0, OFFLINE_PREVIEW);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-accent">
          Directory
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold uppercase sm:text-4xl">
          Streamers
        </h1>
        <p className="mt-2 text-sm text-dim">
          {TOTAL_STREAMERS} Kick channels — live status, viewers and previews update in real time.
        </p>
        <div className="relative mt-4 max-w-md">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Filter streamers..."
            className="w-full rounded-full border border-line bg-elevated py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </header>

      {/* Featured / RV crew */}
      {crew.length > 0 && (
        <section className="mb-12">
          <SectionTitle>Featured / RV Crew</SectionTitle>
          <p className="mt-1 text-sm text-faint">The crew on the trip</p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {crew.map((s) => (
              <div key={s.slug} className="rise">
                <StreamerCard streamer={s} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All live */}
      <section className="mb-12">
        <SectionTitle count={liveList.length}>All Live Streamers</SectionTitle>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!ready && liveList.length === 0
            ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
            : liveList.map((s) => (
                <div key={s.slug} className="rise">
                  <StreamerCard streamer={s} />
                </div>
              ))}
        </div>
        {ready && liveList.length === 0 && (
          <p className="mt-4 text-sm text-faint">No matching streamers are live right now.</p>
        )}
      </section>

      {/* Offline */}
      {offlineList.length > 0 && (
        <section>
          <SectionTitle count={offlineList.length}>Offline Streamers</SectionTitle>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {offlineShown.map((s) => (
              <div key={s.slug} className="rise">
                <StreamerCard streamer={s} />
              </div>
            ))}
          </div>
          {!showAllOffline && offlineList.length > OFFLINE_PREVIEW && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setShowAllOffline(true)}
                className="rounded-full border border-line bg-elevated px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-dim transition hover:border-accent/50 hover:text-accent"
              >
                View all {offlineList.length} offline streamers
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
