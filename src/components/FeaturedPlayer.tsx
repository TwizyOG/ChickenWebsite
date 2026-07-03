"use client";

import { useRef, useState } from "react";
import { useKick } from "./KickProvider";
import { streamerBySlug } from "@/lib/streamers";
import { fetchKickChannel, fmtCount } from "@/lib/kick";
import { KickBadge, VerifiedBadge, MatureBadge, LivePill, FavButton } from "./ui";
import Avatar from "./Avatar";
import KickPlayer from "./KickPlayer";

/* Which surface plays the stream:
   - live + not 18+  → custom KickPlayer (hls.js on the public playback_url):
     Kick-style controls with a quality selector that can force-lock 1080p60.
   - 18+-flagged     → official player.kick.com embed so Kick's own mature
     gate stays intact (that check is theirs to run, not ours to skip).
   - offline / any fatal playback error → official embed (offline card). */

export default function FeaturedPlayer({ slug }: { slug: string }) {
  // Keyed by slug so switching channels naturally resets fallback/refresh
  // state — no reset effect needed.
  return <FeaturedPlayerInner key={slug} slug={slug} />;
}

function FeaturedPlayerInner({ slug }: { slug: string }) {
  const live = useKick(slug);
  const meta = streamerBySlug(slug);
  const name = live.username || meta?.name || slug;

  // Embed-mode only: the cross-origin iframe can't be volume-controlled, but it
  // honours a `muted` URL param — toggling remounts it (new key).
  const [muted, setMuted] = useState(false);

  const [embedFallback, setEmbedFallback] = useState(false);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [playerNonce, setPlayerNonce] = useState(0);
  const refreshed = useRef(false);

  const playbackUrl = freshUrl ?? live.playbackUrl;
  const useCustom = live.live && !live.mature && !!playbackUrl && !embedFallback;

  /** Fatal hls error: IVS playback tokens can rotate mid-stream, so take one
      shot at a fresh channel payload; after that, drop to the official embed
      rather than looping. */
  const handleFatal = async () => {
    if (refreshed.current) {
      setEmbedFallback(true);
      return;
    }
    refreshed.current = true;
    try {
      const fresh = await fetchKickChannel(slug, undefined, { fresh: true });
      if (fresh.live && fresh.playbackUrl) {
        setFreshUrl(fresh.playbackUrl);
        setPlayerNonce((n) => n + 1); // remount even if the URL string matched
      } else {
        setEmbedFallback(true);
      }
    } catch {
      setEmbedFallback(true);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {useCustom ? (
          <KickPlayer
            key={`${slug}:${playerNonce}`}
            src={playbackUrl!}
            name={name}
            poster={live.liveThumbnail || live.banner}
            viewers={live.viewers}
            onFatal={handleFatal}
          />
        ) : (
          <>
            <div className="absolute inset-0 grid place-items-center text-faint">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
            </div>
            {/* Official Kick player — autoplay + fullscreen, native 18+ gate intact */}
            <iframe
              key={`${slug}:${muted ? "m" : "u"}`}
              src={`https://player.kick.com/${encodeURIComponent(slug)}?autoplay=true&muted=${muted}`}
              title={`${name} — Kick player`}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />

            {/* Mute/unmute — the embed has no easy volume control, so drive it via
                the muted param. Sits top-left, clear of the top-right LivePill. */}
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute stream" : "Mute stream"}
              title={muted ? "Unmute" : "Mute"}
              className="absolute left-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-line bg-black/55 text-ink backdrop-blur transition hover:border-accent/50 hover:text-accent"
            >
              {muted ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  <path d="m23 9-6 6M17 9l6 6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
                </svg>
              )}
            </button>

            {live.live && (
              <div className="pointer-events-none absolute right-3 top-3">
                <LivePill viewers={fmtCount(live.viewers)} />
              </div>
            )}
          </>
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
