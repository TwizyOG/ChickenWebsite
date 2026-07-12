"use client";

import Link from "next/link";
import { useKick } from "./KickProvider";
import { fmtCount } from "@/lib/kick";
import type { Streamer } from "@/lib/types";
import { VerifiedBadge, MatureBadge, FavButton } from "./ui";
import Avatar from "./Avatar";

/* Horizontal streamer row matching chickenandy.com/streamers: favourite star,
   avatar, name + title, category / 18+ chips, live viewers, an (i) info button
   (opens the detail panel) and a Watch action. The whole row links to the
   on-site featured player (/?watch={slug}); the star and info button sit above
   that overlay. Rows live inside a bordered list container (see StreamersView). */

function InfoIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export default function StreamerRow({
  streamer,
  onInfo,
}: {
  streamer: Streamer;
  onInfo?: (s: Streamer) => void;
}) {
  const { slug } = streamer;
  const live = useKick(slug);
  const name = live.username || streamer.name;
  const watchHref = `/?watch=${slug}`;

  return (
    <div
      className="group relative border-b border-line transition last:border-0 hover:bg-white/[0.03]"
      style={live.live ? { boxShadow: "inset 3px 0 0 0 #53fc18" } : undefined}
    >
      {/* row-wide click target → feature the stream on-site */}
      <Link href={watchHref} aria-label={`Watch ${name}`} className="absolute inset-0 z-0" />

      <div className="pointer-events-none relative z-10 flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
        <FavButton slug={slug} size={18} className="pointer-events-auto shrink-0" />

        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-elevated sm:h-12 sm:w-12">
          <Avatar slug={slug} name={name} src={live.avatar} size={48} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-ink transition-colors group-hover:text-accent sm:text-base">
              {name}
            </span>
            {live.verified && <VerifiedBadge className="h-3.5 w-3.5 shrink-0" />}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-dim sm:text-sm">
              {live.live ? live.title || live.category || "Live" : live.loaded ? "Offline" : "…"}
            </span>
            {live.live && live.category && (
              <span className="hidden shrink-0 rounded bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-faint md:inline">
                {live.category}
              </span>
            )}
            {live.mature && <MatureBadge />}
          </div>
        </div>

        {/* live status + viewers */}
        {live.live ? (
          <span className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Live
            </span>
            <span className="min-w-[3ch] text-right text-sm font-semibold text-dim">
              {fmtCount(live.viewers)}
            </span>
          </span>
        ) : (
          <span className="hidden shrink-0 text-[11px] font-bold uppercase tracking-wide text-faint sm:inline">
            Offline
          </span>
        )}

        {/* info (i) — opens the detail panel */}
        {onInfo && (
          <button
            type="button"
            aria-label={`${name} details, socials and profile`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInfo(streamer);
            }}
            className="pointer-events-auto grid shrink-0 place-items-center rounded-full border border-line p-2 text-dim transition hover:border-accent/50 hover:text-accent"
          >
            <InfoIcon />
          </button>
        )}

        {/* Watch → on-site featured player */}
        <Link
          href={watchHref}
          className="pointer-events-auto hidden shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold uppercase text-accent-ink transition hover:bg-accent-soft active:scale-95 sm:inline-flex"
        >
          <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch
        </Link>
      </div>
    </div>
  );
}
