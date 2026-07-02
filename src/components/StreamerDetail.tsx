"use client";

import { useEffect } from "react";
import { useKick } from "./KickProvider";
import { fmtCount } from "@/lib/kick";
import type { Streamer, Social } from "@/lib/types";
import Avatar from "./Avatar";
import { KickBadge, VerifiedBadge, MatureBadge, FavButton } from "./ui";

/* Per-streamer detail: profile pic, bio, live status, category history and every
   social link Kick exposes (instagram / x / youtube / tiktok / discord / kick). */

function SocialIcon({ platform }: { platform: string }) {
  const p: Record<string, string> = {
    kick: "M3 3h5v6l4-6h6l-6 9 6 9h-6l-4-6v6H3z",
    instagram:
      "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4a3.7 3.7 0 0 1-1.4-.9 3.7 3.7 0 0 1-.9-1.4c-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2m0 3.4A6.4 6.4 0 1 0 18.4 12 6.4 6.4 0 0 0 12 5.6m0 10.6A4.2 4.2 0 1 1 16.2 12 4.2 4.2 0 0 1 12 16.2m6.6-10.9a1.5 1.5 0 1 0 1.5 1.5 1.5 1.5 0 0 0-1.5-1.5",
    x: "M18.9 2H22l-7 8 8.2 12h-6.4l-5-7.3L6 22H2.9l7.5-8.6L2 2h6.6l4.5 6.6zm-1.1 18h1.7L7.3 3.8H5.5z",
    youtube:
      "M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.7-1.7C19.4 5.2 12 5.2 12 5.2s-7.4 0-8.9.4A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.7 1.7c1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4a2.5 2.5 0 0 0 1.7-1.7C23 15.2 23 12 23 12M9.8 15.3V8.7l5.7 3.3z",
    tiktok:
      "M16.6 5.8a4.8 4.8 0 0 1-1.1-3.1h-3.3v13.2a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V9.9a6 6 0 1 0 5.2 6V9.3a7.9 7.9 0 0 0 4.6 1.5V7.5a4.8 4.8 0 0 1-3.5-1.7",
    discord:
      "M20 4.4A19 19 0 0 0 15.3 3l-.2.4a14 14 0 0 1 4.2 2.1 13 13 0 0 0-4.9-1.6 13.6 13.6 0 0 0-4.9 0A13 13 0 0 0 4.6 5.5 14 14 0 0 1 8.8 3.4L8.6 3A19 19 0 0 0 4 4.4 20 20 0 0 0 .5 18a19 19 0 0 0 5.7 2.9l.5-.7a12 12 0 0 1-2-1l.5-.3a13.6 13.6 0 0 0 11.6 0l.5.3a12 12 0 0 1-2 1l.5.7A19 19 0 0 0 23.5 18 20 20 0 0 0 20 4.4M8.7 15c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.7 2-1.7 2m6.6 0c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.7 2-1.7 2",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d={p[platform] ?? p.kick} />
    </svg>
  );
}

const LABEL: Record<string, string> = {
  kick: "Kick",
  instagram: "Instagram",
  x: "X / Twitter",
  youtube: "YouTube",
  tiktok: "TikTok",
  discord: "Discord",
};

export default function StreamerDetail({
  streamer,
  onClose,
}: {
  streamer: Streamer;
  onClose: () => void;
}) {
  const { slug, name } = streamer;
  const live = useKick(slug);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const socials: Social[] = live.socials.length
    ? live.socials
    : [{ platform: "kick", href: `https://kick.com/${slug}` }];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} details`}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-bg/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel"
      >
        {/* header banner */}
        <div className="relative h-24 bg-[radial-gradient(120%_180%_at_50%_0%,#241d10,#0c0c0f)]">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-line bg-black/40 text-dim hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-10 flex items-end gap-3">
            <Avatar slug={slug} name={name} src={live.avatar} size={80} ring />
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-extrabold">{name}</h2>
                {live.verified && <VerifiedBadge />}
                {live.mature && <MatureBadge />}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-dim">
                <KickBadge />
                {live.followers != null && <span>{fmtCount(live.followers)} followers</span>}
                {live.live ? (
                  <span className="inline-flex items-center gap-1 text-live">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
                    {fmtCount(live.viewers)} live
                  </span>
                ) : (
                  <span className="text-faint">{live.loaded ? "Offline" : "…"}</span>
                )}
              </div>
            </div>
            <div className="ml-auto pb-1">
              <FavButton slug={slug} />
            </div>
          </div>

          {live.title && <p className="mt-4 text-sm font-medium text-ink">{live.title}</p>}
          {live.bio && <p className="mt-2 text-sm leading-relaxed text-dim">{live.bio}</p>}
          {!live.bio && !live.loaded && <div className="skeleton mt-3 h-4 w-3/4 rounded" />}

          {/* category history */}
          {live.categoryHistory.length > 0 && (
            <div className="mt-4">
              <h3 className="font-display text-xs font-bold uppercase tracking-widest text-faint">
                Recent categories
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {live.categoryHistory.map((c) => (
                  <span key={c} className="rounded-full bg-elevated px-2.5 py-1 text-xs text-dim">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* socials */}
          <div className="mt-4">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-faint">
              Socials
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.platform}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-dim transition hover:border-accent/50 hover:text-accent"
                >
                  <SocialIcon platform={s.platform} />
                  {LABEL[s.platform] ?? s.platform}
                </a>
              ))}
            </div>
          </div>

          <a
            href={`https://kick.com/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-2 rounded-full bg-kick/15 px-4 py-2.5 text-sm font-semibold text-kick transition hover:bg-kick/25"
          >
            <SocialIcon platform="kick" />
            Watch on Kick
          </a>
        </div>
      </div>
    </div>
  );
}
