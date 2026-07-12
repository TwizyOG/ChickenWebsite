"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { STREAMERS, CREW_STREAMERS, TOTAL_STREAMERS } from "@/lib/streamers";
import { fmtCount } from "@/lib/kick";
import { useKickMap } from "./KickProvider";
import StreamerRow from "./StreamerRow";
import OfflineCard from "./OfflineCard";
import StreamerDetail from "./StreamerDetail";
import type { Streamer } from "@/lib/types";

/* Streamers page matching chickenandy.com/streamers: the featured RV crew rail
   on top, then the live directory ("All Live Streamers" — horizontal rows with
   viewers + Watch), a stats row, and the offline directory as a compact card
   grid with a show-more / show-less control. */

const OFFLINE_PREVIEW = 12;

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
      {/* Featured / RV crew — top of the page */}
      {crew.length > 0 && (
        <section className="mb-10">
          <SectionTitle count={crew.length}>Featured / RV Crew</SectionTitle>
          <p className="mt-1 text-sm text-faint">The crew on the trip</p>
          <div className="mt-5 overflow-hidden rounded-xl border border-accent/25 bg-panel">
            {crew.map((s) => (
              <StreamerRow key={s.slug} streamer={s} onInfo={setDetail} />
            ))}
          </div>
        </section>
      )}

      {/* All live streamers header */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase sm:text-3xl">
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

      {/* platform legend + helper bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-line bg-panel/50 px-4 py-3 text-xs text-neutral-500">
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
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="h-3 w-3">
              <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9L12 3z" />
            </svg>
            Tap the star to add a favorite
          </span>
        </div>
      </div>

      {/* live list */}
      <section className="mb-10">
        {!ready && liveList.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                <div className="skeleton h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/3 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : liveList.length === 0 ? (
          <div className="rounded-2xl border border-line bg-panel p-10 text-center">
            <p className="font-display text-lg font-extrabold uppercase">
              No one is live right now.
            </p>
            <p className="mt-1 text-sm text-faint">
              Check back soon — streams appear here the moment a creator goes live.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            {liveList.map((s) => (
              <StreamerRow key={s.slug} streamer={s} onInfo={setDetail} />
            ))}
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

      {/* Offline directory — compact card grid */}
      {offlineList.length > 0 && (
        <section className="mb-12">
          <SectionTitle count={offlineList.length}>Offline Streamers</SectionTitle>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offlineShown.map((s) => (
              <OfflineCard key={s.slug} streamer={s} onInfo={setDetail} />
            ))}
          </div>
          {offlineList.length > OFFLINE_PREVIEW && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {!showAllOffline ? (
                <button
                  onClick={() => setShowAllOffline(true)}
                  className="rounded-full border border-line bg-elevated px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-dim transition hover:border-accent/50 hover:text-accent"
                >
                  View all {offlineList.length} offline streamers
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowAllOffline(false)}
                    className="rounded-full border border-line bg-elevated px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-dim transition hover:border-accent/50 hover:text-accent"
                  >
                    Show less
                  </button>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-accent transition hover:bg-accent/10"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                    Top of page
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* community blocks */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
          <h3 className="font-display text-lg font-extrabold uppercase">Community</h3>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Forums for RV life, stream chat, clips and feedback — a home for the ChickenAndy
            community even when streams are offline. Now live.
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
