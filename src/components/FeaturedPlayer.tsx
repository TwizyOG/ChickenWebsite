"use client";

import { useKick } from "./KickProvider";
import { streamerBySlug } from "@/lib/streamers";
import { fmtCount } from "@/lib/kick";
import { KickBadge, VerifiedBadge, MatureBadge, LivePill, FavButton } from "./ui";
import Avatar from "./Avatar";

export default function FeaturedPlayer({ slug }: { slug: string }) {
  const live = useKick(slug);
  const meta = streamerBySlug(slug);
  const name = meta?.name ?? slug;

  return (
    <section className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
      {/* 16:9 official Kick player — autoplay + fullscreen, native 18+ gate intact */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        <div className="absolute inset-0 grid place-items-center text-faint">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
        </div>
        <iframe
          key={slug}
          src={`https://player.kick.com/${encodeURIComponent(slug)}?autoplay=true`}
          title={`${name} — Kick player`}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {live.live && (
          <div className="pointer-events-none absolute right-3 top-3">
            <LivePill viewers={fmtCount(live.viewers)} />
          </div>
        )}
      </div>

      {/* meta row */}
      <div className="mt-4 flex flex-wrap items-center gap-4 px-1">
        <Avatar slug={slug} name={name} src={live.avatar} size={52} ring />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-extrabold">{name}</h3>
            {live.verified && <VerifiedBadge />}
            <KickBadge />
          </div>
          <p className="mt-0.5 max-w-md truncate text-sm text-dim">
            {live.title || (live.loaded ? "Offline — replays on Kick" : "Loading stream…")}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {live.live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-xs text-dim">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {fmtCount(live.viewers)} watching
              </span>
            )}
            {live.category && (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-dim">
                {live.category}
              </span>
            )}
            {live.mature && <MatureBadge />}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={`https://kick.com/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-kick/15 px-4 py-2 text-sm font-semibold text-kick transition hover:bg-kick/25"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M3 3h5v6l4-6h6l-6 9 6 9h-6l-4-6v6H3z" />
            </svg>
            Watch on Kick
          </a>
          <FavButton slug={slug} />
        </div>
      </div>
    </section>
  );
}
