"use client";

import { useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import { fmtCount } from "@/lib/kick";
import { fmtDuration, type RvxMediaItem } from "@/lib/rvxMedia";
import { KickBadge, MatureBadge } from "./ui";

/* RV X clip/VOD lightbox.
   - non-mature CLIP → inline hls.js on the CORS-open clips.kick.com master.
   - VOD, or any mature item → Kick's official embed (keeps their 18+ gate and
     seek/quality UI, and sidesteps stream.kick.com having no CORS for VODs). */

function ClipVideo({ src, poster }: { src: string; poster?: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let hls: HlsType | null = null;

    (async () => {
      // Prefer hls.js (MSE) wherever supported. Chromium reports
      // canPlayType("application/vnd.apple.mpegurl") === "maybe" yet can't
      // actually decode HLS natively, so native HLS must be the *fallback*
      // (Safari), never the first choice — mirrors KickPlayer's ordering.
      const { default: Hls } = await import("hls.js");
      if (disposed) return;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls!.recoverMediaError();
            return;
          }
          setFailed(true);
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src; // Safari native HLS
        video.play().catch(() => {});
      } else {
        setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      hls?.destroy();
      video.removeAttribute("src");
    };
  }, [src]);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-black text-center text-sm text-faint">
        Couldn&apos;t play this clip here — use “Watch on Kick”.
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      poster={poster || undefined}
      controls
      autoPlay
      playsInline
      className="h-full w-full bg-black"
    />
  );
}

export default function RvxMediaPlayer({
  item,
  onClose,
}: {
  item: RvxMediaItem | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const inlineClip = item.kind === "clip" && !item.mature && Boolean(item.hlsUrl);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video w-full shrink-0 bg-black">
          {inlineClip ? (
            <ClipVideo src={item.hlsUrl!} poster={item.thumbnail} />
          ) : (
            <iframe
              key={item.id}
              src={item.embedUrl || item.watchUrl}
              title={item.title}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur transition hover:bg-kick hover:text-black"
          >
            ✕
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-line p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                {item.kind}
              </span>
              {item.mature && <MatureBadge />}
              <h3 className="truncate font-display text-base font-bold">{item.title}</h3>
            </div>
            <p className="mt-1 text-xs text-faint">
              {item.channelName} · {item.date} · {fmtDuration(item.durationSec)} ·{" "}
              {fmtCount(item.views)} views
            </p>
          </div>
          <a
            href={item.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-kick/15 px-3.5 py-2 text-sm font-semibold text-kick transition hover:bg-kick/25"
          >
            <KickBadge />
            Watch on Kick
          </a>
        </div>
      </div>
    </div>
  );
}
