"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import { fmtCount, hlsMasterUrl } from "@/lib/kick";

/* =============================================================================
   Custom Kick-style live player.

   Plays the channel's public `playback_url` (the same IVS HLS master manifest
   kick.com's own player consumes) through hls.js, which exposes every
   rendition — incl. 1080p60 source — behind a Kick-style settings menu with a
   real quality LOCK: picking a level pins hls.js to it (ABR off) and persists
   the choice in localStorage, so streams keep opening in HD without a trip to
   kick.com.

   18+-flagged channels never reach this component — FeaturedPlayer keeps the
   official player.kick.com embed for those so Kick's own mature-content gate
   stays intact. Any fatal playback error also falls back to the embed.
   ========================================================================== */

type QualityPref = { h: number; f: number } | "auto";
type LevelInfo = { idx: number; height: number; fps: number; label: string };

const QUALITY_KEY = "player:quality";
const VOLUME_KEY = "player:volume";
const MUTED_KEY = "player:muted";

const levelLabel = (height: number, fps: number) => {
  const f = Math.round(fps || 30);
  return `${height}p${f > 30 ? f : ""}`;
};

function readPref(): QualityPref {
  try {
    const raw = localStorage.getItem(QUALITY_KEY);
    if (!raw || raw === "auto") return "auto";
    const p = JSON.parse(raw) as { h?: number; f?: number };
    if (typeof p.h === "number" && typeof p.f === "number") return { h: p.h, f: p.f };
  } catch {
    /* fresh browser */
  }
  return "auto";
}

function savePref(pref: QualityPref) {
  try {
    localStorage.setItem(QUALITY_KEY, pref === "auto" ? "auto" : JSON.stringify(pref));
  } catch {
    /* quota */
  }
}

/** Best level for a saved pref: exact height+fps → same height → next height
    down (a 720p-max stream honours a 1080p60 lock at 720p60, like Kick). */
function pickLevel(levels: { height: number; frameRate?: number }[], pref: { h: number; f: number }): number {
  let exact = -1;
  let sameH = -1;
  let sameHFps = -1;
  let below = -1;
  let belowH = -1;
  levels.forEach((l, i) => {
    const f = Math.round(l.frameRate || 30);
    if (l.height === pref.h && f === pref.f) exact = i;
    if (l.height === pref.h && f > sameHFps) {
      sameHFps = f;
      sameH = i;
    }
    if (l.height < pref.h && l.height > belowH) {
      belowH = l.height;
      below = i;
    }
  });
  return exact >= 0 ? exact : sameH >= 0 ? sameH : below;
}

/* ------------------------------- icons ---------------------------------- */

const I = {
  play: <path d="M8 5.5v13l11-6.5z" />,
  pause: <path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" />,
  volume: (
    <>
      <path d="M4 9v6h3.5L12 19V5L7.5 9z" />
      <path d="M14.5 8.7a4.7 4.7 0 0 1 0 6.6M17.2 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  muted: (
    <>
      <path d="M4 9v6h3.5L12 19V5L7.5 9z" />
      <path d="m15 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  gear: (
    <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6m9 5.3-2.1 1.7q.1.9-.2 1.7l1.4 2.3-2.2 2.2-2.3-1.4q-.8.3-1.7.4L12.6 23h-1.2l-1.3-2.6q-.9-.1-1.7-.4l-2.3 1.4-2.2-2.2 1.4-2.3q-.3-.8-.4-1.7L2.3 13.6v-1.2l2.6-1.3q.1-.9.4-1.7L3.9 7.1l2.2-2.2 2.3 1.4q.8-.3 1.7-.4L11.4 3h1.2l1.3 2.9q.9.1 1.7.4l2.3-1.4 2.2 2.2-1.4 2.3q.3.8.4 1.7l2.9 1.2z" fillRule="evenodd" />
  ),
  pip: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="12" y="11.5" width="7" height="5" rx="1" />
    </>
  ),
  expand: (
    <path d="M4 9V4h5v2H6v3zm10-5h6v5h-2V6h-4zM4 15h2v3h3v2H4zm14 0h2v5h-6v-2h4z" />
  ),
  shrink: (
    <path d="M9 4v5H4V7h3V4zm6 0h2v3h3v2h-5zM4 15h5v5H7v-3H4zm11 0h5v2h-3v3h-2z" />
  ),
};

function Icon({ d, className = "h-5 w-5" }: { d: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      {d}
    </svg>
  );
}

/* ------------------------------- player --------------------------------- */

export default function KickPlayer({
  src,
  name,
  poster,
  viewers = 0,
  onFatal,
}: {
  src: string;
  name: string;
  poster?: string | null;
  viewers?: number;
  onFatal?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFatalRef = useRef(onFatal);
  useEffect(() => {
    onFatalRef.current = onFatal;
  }, [onFatal]);

  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [levels, setLevels] = useState<LevelInfo[]>([]);
  const [current, setCurrent] = useState(-1); // forced level idx, -1 = auto
  const [autoLabel, setAutoLabel] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [nativeHls, setNativeHls] = useState(false);

  /* --- source lifecycle --- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let hls: HlsType | null = null;
    // Kick's raw master has no CORS header; play it through our shim (see
    // hlsMasterUrl). Media playlists + segments load browser-direct.
    const master = hlsMasterUrl(src);

    let savedVol = 1;
    let savedMuted = false;
    try {
      savedVol = Math.min(1, Math.max(0, Number(localStorage.getItem(VOLUME_KEY) ?? 1)));
      if (Number.isNaN(savedVol)) savedVol = 1;
      savedMuted = localStorage.getItem(MUTED_KEY) === "1";
    } catch {
      /* fresh browser */
    }
    video.volume = savedVol;
    video.muted = savedMuted;
    setVolume(savedVol);
    setMuted(savedMuted);

    const tryPlay = () => {
      video
        .play()
        .then(() => setPaused(false))
        .catch(() => {
          if (disposed) return;
          // Autoplay with sound blocked — start muted like Kick does and
          // surface a "tap to unmute" pill.
          video.muted = true;
          setMuted(true);
          setNeedsUnmute(true);
          video
            .play()
            .then(() => setPaused(false))
            .catch(() => setPaused(true));
        });
    };

    (async () => {
      const { default: Hls } = await import("hls.js");
      if (disposed) return;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          // Never downgrade below the locked quality just because the element
          // is small — the whole point is forced 1080p60 in the page player.
          capLevelToPlayerSize: false,
          backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(master);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (disposed || !hls) return;
          const ls = hls.levels.map((l, i) => ({
            idx: i,
            height: l.height,
            fps: Math.round(l.frameRate || 30),
            label: levelLabel(l.height, l.frameRate),
          }));
          // Menu lists top quality first, like Kick's.
          setLevels([...ls].sort((a, b) => b.height - a.height || b.fps - a.fps));
          const pref = readPref();
          if (pref !== "auto") {
            const idx = pickLevel(hls.levels, pref);
            if (idx >= 0) {
              hls.currentLevel = idx; // lock from the very first frames
              setCurrent(idx);
            }
          }
          tryPlay();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => {
          if (disposed || !hls) return;
          const l = hls.levels[d.level];
          if (l) setAutoLabel(levelLabel(l.height, l.frameRate));
        });

        let netRetries = 0;
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (disposed || !hls || !data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < 2) {
            netRetries += 1;
            const h = hls;
            setTimeout(() => h.startLoad(), 1000 * netRetries);
            return;
          }
          onFatalRef.current?.(); // parent refreshes the token or embeds
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari — native HLS handles ABR itself; no per-level lock available.
        setNativeHls(true);
        setBuffering(false);
        video.src = master;
        video.addEventListener("loadedmetadata", tryPlay, { once: true });
      } else {
        onFatalRef.current?.();
      }
    })();

    return () => {
      disposed = true;
      hlsRef.current = null;
      hls?.destroy();
      video.removeAttribute("src");
    };
  }, [src]);

  /* --- element state mirroring --- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onVol = () => {
      setMuted(v.muted);
      setVolume(v.volume);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("volumechange", onVol);
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("volumechange", onVol);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  /* --- actions --- */
  const goLiveEdge = useCallback(() => {
    const v = videoRef.current;
    const hls = hlsRef.current;
    if (!v) return;
    const edge = hls?.liveSyncPosition;
    if (edge && Number.isFinite(edge) && edge - v.currentTime > 5) v.currentTime = edge;
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      goLiveEdge(); // resume at the live edge, not where we paused
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [goLiveEdge]);

  const setQuality = (idx: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = idx; // immediate switch; manual pick disables ABR = lock
    setCurrent(idx);
    if (idx < 0) {
      savePref("auto");
    } else {
      const l = hls.levels[idx];
      if (l) savePref({ h: l.height, f: Math.round(l.frameRate || 30) });
    }
    setMenu(false);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) setNeedsUnmute(false);
    try {
      localStorage.setItem(MUTED_KEY, v.muted ? "1" : "0");
    } catch {
      /* quota */
    }
  };

  const changeVolume = (x: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = x;
    if (x > 0 && v.muted) v.muted = false;
    if (x > 0) setNeedsUnmute(false);
    try {
      localStorage.setItem(VOLUME_KEY, String(x));
      localStorage.setItem(MUTED_KEY, v.muted ? "1" : "0");
    } catch {
      /* quota */
    }
  };

  const unmuteNow = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    if (v.volume === 0) v.volume = 0.5;
    setNeedsUnmute(false);
    try {
      localStorage.setItem(MUTED_KEY, "0");
    } catch {
      /* quota */
    }
  };

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen().catch(() => {});
  }, []);

  const togglePip = async () => {
    const v = videoRef.current;
    if (!v || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* unsupported / denied */
    }
  };

  /* --- controls visibility --- */
  const poke = useCallback(() => {
    setControls(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setControls(false), 2600);
  }, []);
  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    [],
  );

  const showControls = controls || paused || menu || needsUnmute;
  const currentLabel =
    current >= 0 ? levels.find((l) => l.idx === current)?.label ?? "…" : autoLabel;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = videoRef.current;
    if (!v) return;
    if (e.key === " " || e.key.toLowerCase() === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key.toLowerCase() === "m") toggleMute();
    else if (e.key.toLowerCase() === "f") toggleFullscreen();
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      changeVolume(Math.min(1, v.volume + 0.1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      changeVolume(Math.max(0, v.volume - 0.1));
    }
  };

  const btn =
    "grid h-9 w-9 place-items-center rounded-md text-white/90 transition hover:text-kick focus:outline-none focus-visible:ring-2 focus-visible:ring-kick";

  return (
    <div
      ref={containerRef}
      onMouseMove={poke}
      onTouchStart={poke}
      onMouseLeave={() => setControls(false)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      className="group/player absolute inset-0 bg-black outline-none"
      aria-label={`${name} live player`}
    >
      <video
        ref={videoRef}
        poster={poster || undefined}
        playsInline
        className="h-full w-full object-contain"
      />

      {/* click layer: tap = play/pause, double = fullscreen */}
      <div
        className="absolute inset-0"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* buffering spinner */}
      {buffering && !paused && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-kick" />
        </div>
      )}

      {/* big center play when paused */}
      {paused && !buffering && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-kick hover:text-black"
        >
          <Icon d={I.play} className="h-8 w-8" />
        </button>
      )}

      {/* tap-to-unmute pill (autoplay started muted) */}
      {needsUnmute && (
        <button
          type="button"
          onClick={unmuteNow}
          className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full bg-black/70 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-white backdrop-blur transition hover:bg-kick hover:text-black"
        >
          <Icon d={I.muted} className="h-4 w-4" />
          Tap to unmute
        </button>
      )}

      {/* control bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-1.5 pt-8 transition-opacity duration-200 ${
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={togglePlay} aria-label={paused ? "Play" : "Pause"} className={btn}>
            <Icon d={paused ? I.play : I.pause} />
          </button>

          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className={btn}>
            <Icon d={muted || volume === 0 ? I.muted : I.volume} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            aria-label="Volume"
            className="h-1 w-16 cursor-pointer sm:w-20"
            style={{ accentColor: "var(--color-kick)" }}
          />

          {/* LIVE + viewers — clicking snaps back to the live edge */}
          <button
            type="button"
            onClick={() => {
              goLiveEdge();
              videoRef.current?.play().catch(() => {});
            }}
            title="Jump to live edge"
            className="ml-2 flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-white/10"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
              <span className="live-dot h-2 w-2 rounded-full bg-live" />
              Live
            </span>
            <span className="hidden items-center gap-1 text-xs font-semibold text-white/80 sm:flex">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {fmtCount(viewers)}
            </span>
          </button>

          <div className="flex-1" />

          {/* settings / quality */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-label="Settings"
              aria-expanded={menu}
              className={`${btn} ${menu ? "text-kick" : ""}`}
              title={`Quality: ${current >= 0 ? currentLabel : `Auto${currentLabel ? ` (${currentLabel})` : ""}`}`}
            >
              <Icon d={I.gear} />
            </button>

            {menu && (
              <div className="absolute bottom-11 right-0 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#141517]/95 shadow-2xl backdrop-blur">
                <div className="border-b border-white/10 px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white/50">
                  Quality
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  <button
                    type="button"
                    onClick={() => setQuality(-1)}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm text-white/90 transition hover:bg-white/5"
                  >
                    <span>
                      Auto
                      {current < 0 && autoLabel ? (
                        <span className="ml-1.5 text-xs text-white/45">({autoLabel})</span>
                      ) : null}
                    </span>
                    {current < 0 && <Check />}
                  </button>
                  {nativeHls ? (
                    <p className="px-3.5 py-2 text-xs leading-relaxed text-white/45">
                      This browser manages quality automatically (native HLS).
                    </p>
                  ) : levels.length === 0 ? (
                    <p className="px-3.5 py-2 text-xs text-white/45">Loading renditions…</p>
                  ) : (
                    levels.map((l) => (
                      <button
                        key={l.idx}
                        type="button"
                        onClick={() => setQuality(l.idx)}
                        className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm text-white/90 transition hover:bg-white/5"
                      >
                        <span>
                          {l.label}
                          {l.height >= 1080 && (
                            <span className="ml-1.5 rounded bg-kick/15 px-1 py-px text-[9px] font-extrabold uppercase text-kick">
                              HD
                            </span>
                          )}
                        </span>
                        {current === l.idx && <Check />}
                      </button>
                    ))
                  )}
                </div>
                {!nativeHls && (
                  <div className="border-t border-white/10 px-3.5 py-2 text-[10px] leading-relaxed text-white/40">
                    Picked quality is locked — it won&apos;t auto-switch and is remembered for
                    every stream.
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="button" onClick={togglePip} aria-label="Picture in picture" className={`${btn} hidden sm:grid`}>
            <Icon d={I.pip} />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className={btn}
          >
            <Icon d={fullscreen ? I.shrink : I.expand} />
          </button>
        </div>
      </div>

      {/* click-away for the settings menu */}
      {menu && <div className="absolute inset-0 z-[5]" onClick={() => setMenu(false)} />}
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-kick" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}
