"use client";

import { useState } from "react";
import { useKick } from "./KickProvider";
import { fmtCount } from "@/lib/kick";
import type { Streamer } from "@/lib/types";
import { KickBadge, VerifiedBadge, MatureBadge, LivePill, FavButton } from "./ui";
import Avatar from "./Avatar";

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-elevated">
      <div className="skeleton aspect-video" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

export default function StreamerCard({
  streamer,
  onSelect,
  onInfo,
  liveThumb = false,
}: {
  streamer: Streamer;
  onSelect?: (slug: string) => void;
  onInfo?: (streamer: Streamer) => void;
  /** Home page: show the real live-stream frame (`images.kick.com`, from the
      livestream endpoint), falling back to the channel banner, then the avatar.
      Elsewhere the card keeps its avatar treatment. */
  liveThumb?: boolean;
}) {
  const { slug } = streamer;
  const live = useKick(slug);
  const [thumbBroken, setThumbBroken] = useState(false);

  // Prefer Kick's properly-cased username once hydrated (roster name is a slug fallback).
  const name = live.username || streamer.name;
  const thumbSrc = liveThumb ? live.liveThumbnail || live.banner : live.thumbnail;

  return (
    <div className="group relative overflow-hidden rounded-card border border-line bg-elevated transition hover:border-accent/40 hover:shadow-[0_0_0_1px_rgba(227,178,60,0.15)]">
      {/* thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-black">
        {live.live && thumbSrc && !thumbBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={`${name} stream thumbnail`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setThumbBroken(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[radial-gradient(120%_120%_at_50%_0%,#1b1b22,#0c0c0f)]">
            <Avatar slug={slug} name={name} src={live.avatar} size={56} />
          </div>
        )}

        {live.live && (
          <div className="absolute left-2 top-2">
            <LivePill viewers={`${fmtCount(live.viewers)} viewers`} />
          </div>
        )}

        {!live.live && (
          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint backdrop-blur-sm">
            {live.loaded ? "Offline" : "…"}
          </span>
        )}
      </div>

      {/* meta */}
      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-display text-sm font-bold">{name}</h3>
          {live.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-faint">
          <span className="truncate">{live.category || (live.live ? "Live" : "Kick")}</span>
          <KickBadge className="ml-auto shrink-0" />
        </div>
      </div>

      {/* full-card click target — sibling overlay (keeps FavButton un-nested) */}
      {onSelect ? (
        <button
          type="button"
          aria-label={`Watch ${name}`}
          onClick={() => onSelect(slug)}
          className="absolute inset-0 z-10"
        />
      ) : (
        <a
          href={`https://kick.com/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${name} on Kick`}
          className="absolute inset-0 z-10"
        />
      )}

      {/* top-right cluster sits above the click target */}
      <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
        {live.mature && <MatureBadge />}
        {onInfo && (
          <button
            type="button"
            aria-label={`${name} details, socials and profile`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInfo(streamer);
            }}
            className="grid place-items-center rounded-full border border-line bg-black/40 p-2 text-dim opacity-0 transition hover:border-accent/50 hover:text-accent group-hover:opacity-100"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
        )}
        <FavButton slug={slug} size={14} className="opacity-0 transition group-hover:opacity-100" />
      </div>
    </div>
  );
}
