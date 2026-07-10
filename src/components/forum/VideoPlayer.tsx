"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Reddit-style feed video player: autoplays muted when ≥60% visible, pauses +
   re-mutes off-screen, click unmutes first (then toggles play), only one
   audible player at a time, custom controls (scrub + buffered track, volume
   persisted, time, fullscreen). `.m3u8` sources go through hls.js (dynamic
   import); uploaded mp4/webm play natively. */

const VOL_KEY = "forum:volume";

// Only one player is audible at a time.
let muteCurrent: (() => void) | null = null;

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function VideoPlayer({
  src,
  poster = null,
  width = null,
  height = null,
}: {
  src: string;
  poster?: string | null;
  width?: number | null;
  height?: number | null;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPaused = useRef(false);
  const myMute = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);

  // restore persisted volume once
  useEffect(() => {
    const v = Number(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(v) && v > 0 && v <= 1) setVolume(v);
  }, []);
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.volume = volume;
  }, [volume]);

  // source: native for mp4/webm, hls.js for .m3u8
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!src.includes(".m3u8")) {
      el.src = src;
      return;
    }
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled || !videoRef.current) return;
      if (Hls.isSupported()) {
        const h = new Hls();
        h.loadSource(src);
        h.attachMedia(videoRef.current);
        hls = h;
      } else {
        videoRef.current.src = src; // Safari native HLS
      }
    })();
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  // reddit-style visibility autoplay
  useEffect(() => {
    const wrap = wrapRef.current;
    const el = videoRef.current;
    if (!wrap || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.6) {
          if (!userPaused.current) el.play().catch(() => {});
        } else {
          el.pause();
          if (!el.muted) {
            el.muted = true;
            setMuted(true);
            if (muteCurrent === myMute.current) muteCurrent = null;
          }
        }
      },
      { threshold: [0, 0.6] },
    );
    io.observe(wrap);
    return () => {
      io.disconnect();
      if (muteCurrent === myMute.current) muteCurrent = null;
    };
  }, []);

  const unmute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    muteCurrent?.(); // silence whoever was audible
    el.muted = false;
    setMuted(false);
    myMute.current = () => {
      el.muted = true;
      setMuted(true);
    };
    muteCurrent = myMute.current;
  }, []);

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      userPaused.current = false;
      el.play().catch(() => {});
    } else {
      userPaused.current = true;
      el.pause();
    }
  }

  function onVideoClick() {
    const el = videoRef.current;
    if (!el) return;
    if (el.muted) {
      unmute();
      if (el.paused) togglePlay();
    } else {
      togglePlay();
    }
  }

  function onScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const el = videoRef.current;
    if (!el || !duration) return;
    el.currentTime = (Number(e.target.value) / 1000) * duration;
  }

  function toggleFullscreen() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.requestFullscreen().catch(() => {});
  }

  const pct = duration ? (time / duration) * 1000 : 0;
  const bufferedPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;

  return (
    <div
      ref={wrapRef}
      className="group relative w-full overflow-hidden bg-black"
      style={{ aspectRatio: width && height ? `${width} / ${height}` : "16 / 9" }}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        muted
        playsInline
        loop
        preload="metadata"
        onClick={onVideoClick}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setBuffered(b.end(b.length - 1));
        }}
        className="h-full w-full cursor-pointer object-contain"
      />

      {muted && (
        <button
          type="button"
          onClick={onVideoClick}
          className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm"
        >
          Tap for sound
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-6 transition-transform group-hover:translate-y-0">
        <div className="relative h-1 w-full">
          <div className="absolute inset-0 rounded-full bg-white/20" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/30"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${pct / 10}%` }}
          />
          <input
            type="range"
            min={0}
            max={1000}
            value={pct}
            onChange={onScrub}
            aria-label="Seek"
            className="absolute inset-x-0 -top-1.5 h-4 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-white">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M8 5l11 7-11 7z" />
              </svg>
            )}
          </button>
          <span className="text-[11px] font-semibold tabular-nums">
            {fmtTime(time)} / {fmtTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => (muted ? unmute() : muteCurrent?.())}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3z" />
                  <path d="M16 8l5 8M21 8l-5 8" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3z" />
                  <path d="M16 8a6 6 0 010 8" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              aria-label="Volume"
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setVolume(v);
                localStorage.setItem(VOL_KEY, String(v));
                if (v > 0 && muted) unmute();
              }}
              className="h-1 w-16 cursor-pointer accent-[var(--color-accent)]"
            />
            <button type="button" onClick={toggleFullscreen} aria-label="Fullscreen">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
