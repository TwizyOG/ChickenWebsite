"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { STREAMERS, CREW_STREAMERS, TOTAL_STREAMERS } from "@/lib/streamers";
import { fmtCount } from "@/lib/kick";
import { useKickMap } from "./KickProvider";
import StreamerCard, { CardSkeleton } from "./StreamerCard";
import StreamerDetail from "./StreamerDetail";
import type { Streamer } from "@/lib/types";

/* Streamers page matching chickenandy.vercel.app/streamers: "All Live
   Streamers / Browse everyone live" header with sort + live-count chip,
   platform filter chips, the star/channel helper line, the live grid, the
   stats row and the community blocks — plus the retained full 113-channel
   roster (crew rail + offline directory) hydrating live from Kick. */

const OFFLINE_PREVIEW = 15;

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-xl font-extrabold uppercase sm:text-2xl">
      <span className="h-6 w-1.5 rounded-full bg-accent" />
      {children}
      {count != null && <span className="text-base font-semibold text-faint">{count}</span>}
    </h2>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-black text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-faint">{sub}</p>
    </div>
  );
}

export default function StreamersView() {
  const params = useSearchParams();
  const { live, ready } = useKickMap();
  const [sortDesc, setSortDesc] = useState(true);
  const [showAllOffline, setShowAllOffline] = useState(false);
  const [detail, setDetail] = useState<Streamer | null>(null);

  const q = (params.get("q") ?? "").toLowerCase().trim();
  const match = (s: Streamer) =>
    !q || s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);

  const { crew, liveList, offlineList, totalViewers, topViewers } = useMemo(() => {
    const filtered = STREAMERS.filter(match);
    const crewSlugs = new Set(CREW_STREAMERS.map((c) => c.slug));
    const liveList = filtered
      .filter((s) => live[s.slug]?.live)
      .sort((a, b) => {
        const d = (live[b.slug]?.viewers ?? 0) - (live[a.slug]?.viewers ?? 0);
        return sortDesc ? d : -d;
      });
    const offlineList = filtered.filter((s) => !live[s.slug]?.live && !crewSlugs.has(s.slug));
    const crew = CREW_STREAMERS.filter(match);
    const totalViewers = liveList.reduce((sum, s) => sum + (live[s.slug]?.viewers ?? 0), 0);
    const topViewers = liveList.length ? live[liveList[0].slug]?.viewers ?? 0 : 0;
    return { crew, liveList, offlineList, totalViewers, topViewers };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, q, sortDesc]);

  const offlineShown = showAllOffline ? offlineList : offlineList.slice(0, OFFLINE_PREVIEW);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* header row */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase sm:text-4xl">
            All Live Streamers
          </h1>
          <p className="mt-1 text-sm text-dim">Browse everyone live</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortDesc((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-elevated px-3 py-1.5 text-xs text-dim transition hover:text-ink"
          >
            <span className="font-semibold text-ink">{sortDesc ? "Highest" : "Lowest"}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent">
            {liveList.length} live now
          </span>
        </div>
      </header>

      {/* platform legend + helper bar (1:1 with the live site) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-line bg-panel/50 px-4 py-3 text-xs text-neutral-500">
        <div className="flex items-center gap-4">
          {(
            [
              ["Kick", "#53fc18"],
              ["Twitch", "#9146ff"],
              ["YouTube", "#ff0000"],
            ] as const
          ).map(([name, color]) => (
            <span key={name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              {name}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>Click any streamer to view their channel</span>
          <span className="flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9L12 3z" />
            </svg>
            Tap the star to add a favorite
          </span>
        </div>
      </div>

      {/* live grid */}
      <section className="mb-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!ready && liveList.length === 0
            ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
            : liveList.map((s) => (
                <div key={s.slug} className="rise">
                  <StreamerCard streamer={s} onInfo={setDetail} />
                </div>
              ))}
        </div>
        {ready && liveList.length === 0 && (
          <div className="rounded-2xl border border-line bg-panel p-10 text-center">
            <p className="font-display text-lg font-extrabold uppercase">
              No one is live right now.
            </p>
            <p className="mt-1 text-sm text-faint">
              Check back soon — streams appear here the moment a creator goes live.
            </p>
          </div>
        )}
      </section>

      {/* stats */}
      <section className="mb-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Live Now" value={String(liveList.length)} sub="Streamers live right now" />
        <Stat label="Total Viewers" value={fmtCount(totalViewers)} sub="Across all live streams" />
        <Stat label="Creators" value={String(TOTAL_STREAMERS)} sub="Total streamers" />
        <Stat label="Top Stream" value={fmtCount(topViewers)} sub="Highest viewers now" />
      </section>

      {/* Featured / RV crew (retained roster rail) */}
      {crew.length > 0 && (
        <section className="mb-12">
          <SectionTitle>Featured / RV Crew</SectionTitle>
          <p className="mt-1 text-sm text-faint">The crew on the trip</p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {crew.map((s) => (
              <div key={s.slug} className="rise">
                <StreamerCard streamer={s} onInfo={setDetail} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Offline directory (retained full roster) */}
      {offlineList.length > 0 && (
        <section className="mb-12">
          <SectionTitle count={offlineList.length}>Offline Streamers</SectionTitle>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {offlineShown.map((s) => (
              <div key={s.slug} className="rise">
                <StreamerCard streamer={s} onInfo={setDetail} />
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

      {/* community blocks */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-extrabold uppercase">Community</h3>
            <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-faint">
              Coming soon
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Forums for RV life, stream chat, clips and feedback — a home for the ChickenAndy
            community even when streams are offline.
          </p>
          <Link
            href="/community"
            className="mt-5 inline-block rounded-lg border border-line px-4 py-2 text-sm font-semibold text-dim transition hover:border-accent/50 hover:text-ink"
          >
            Explore community
          </Link>
        </div>

        <div className="rounded-2xl border border-accent/30 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(227,178,60,0.12),transparent)] p-6 sm:p-8">
          <h3 className="font-display text-lg font-extrabold uppercase text-accent">
            Join our community
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Be part of something amazing! Join our Discord to connect with streamers and fans.
          </p>
          <Link
            href="/community"
            className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
          >
            Join the community
          </Link>
        </div>
      </section>

      {detail && <StreamerDetail streamer={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
