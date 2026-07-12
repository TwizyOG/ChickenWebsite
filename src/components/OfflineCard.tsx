"use client";

import { useKick } from "./KickProvider";
import type { Streamer } from "@/lib/types";
import { FavButton } from "./ui";
import Avatar from "./Avatar";

/* Compact offline-directory card matching chickenandy.com/streamers: a small
   grid tile with the favourite star, avatar, name + platform and an OFFLINE
   badge. The whole card links to the channel on Kick; the star and (i) info
   button sit above that overlay. */

function InfoIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export default function OfflineCard({
  streamer,
  onInfo,
}: {
  streamer: Streamer;
  onInfo?: (s: Streamer) => void;
}) {
  const { slug } = streamer;
  const live = useKick(slug);
  const name = live.username || streamer.name;

  return (
    <div className="group relative flex items-center gap-3 rounded-lg border border-line bg-panel p-3 transition hover:border-neutral-600">
      <a
        href={`https://kick.com/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${name} on Kick`}
        className="absolute inset-0 z-0"
      />
      <FavButton slug={slug} size={16} className="pointer-events-auto relative z-10 shrink-0" />

      <span className="pointer-events-none relative z-0 h-9 w-9 shrink-0 overflow-hidden rounded-full bg-elevated">
        <Avatar slug={slug} name={name} src={live.avatar} size={36} />
      </span>

      <span className="pointer-events-none relative z-0 min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-300">{name}</span>
        <span className="block truncate text-xs text-faint">Kick</span>
      </span>

      {onInfo && (
        <button
          type="button"
          aria-label={`${name} details, socials and profile`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInfo(streamer);
          }}
          className="pointer-events-auto relative z-10 grid shrink-0 place-items-center rounded-full border border-line p-1.5 text-dim transition hover:border-accent/50 hover:text-accent"
        >
          <InfoIcon />
        </button>
      )}

      <span className="pointer-events-none relative z-0 shrink-0 rounded bg-elevated px-2 py-0.5 text-[10px] font-bold uppercase text-faint">
        Offline
      </span>
    </div>
  );
}
