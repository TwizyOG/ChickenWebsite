/* =============================================================================
   RV X — real Clips & VODs, hydrated client-side from Kick's public API.

   Replaces the old procedurally-faked RVX_CLIPS/RVX_VODS (which were single-
   channel, gradient-thumbnailed and unplayable) for the hub's "Clips & VODs"
   tab. Every item here is a real Kick clip or past broadcast:

     - Clips  → GET /channels/{slug}/clips   (HLS `video_url` is CORS-open `*`,
                so it plays inline through hls.js — no server, no shim).
     - VODs   → GET /channels/{slug}/videos  (HLS `source` on stream.kick.com
                has NO CORS, so a custom player can't read it without proxying
                every video byte; those play via Kick's official embed instead).

   Only the *active* crew's channels are fetched — past crew (Tazo, Ocean
   Adventures, …) never surface here, so the calendar built from these items
   reflects active crew only, by construction. Both list endpoints reflect our
   Origin, so the keyless client-side fetch pattern from lib/kick.ts applies.
   ========================================================================== */

import { CREW } from "./rvx";

const BASE = "https://kick.com/api/v2/channels/";

/** Active crew (still on the trip) with a Kick channel — drives every fetch,
    so the media set and its calendar include active crew only. */
export const ACTIVE_CREW: { slug: string; name: string }[] = CREW.filter(
  (m) => !m.departed && m.slug,
).map((m) => ({ slug: m.slug as string, name: m.name }));

const CREW_NAME: Record<string, string> = Object.fromEntries(
  ACTIVE_CREW.map((c) => [c.slug, c.name]),
);

export type RvxMediaItem = {
  id: string;
  kind: "clip" | "vod";
  title: string;
  channelSlug: string;
  channelName: string;
  /** Real capture instant (Kick `created_at`). */
  time: number;
  /** "MM/DD/YY" — the calendar's day key, from the local date of `time`. */
  date: string;
  durationSec: number;
  views: number;
  mature: boolean;
  /** Real Kick thumbnail (webp). */
  thumbnail: string | null;
  /** CORS-open HLS master for inline hls.js playback (clips only). */
  hlsUrl: string | null;
  /** Official Kick embed (VODs, and any mature clip we won't inline-play). */
  embedUrl: string | null;
  /** Public Kick watch page. */
  watchUrl: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "MM/DD/YY" (local), matching the media calendar's cell keys. */
export function mdy(d: Date): string {
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)}`;
}

/** Seconds → "H:MM:SS" (VOD-length) or "M:SS" (clip-length). */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** Kick video `created_at` is "YYYY-MM-DD HH:MM:SS" (UTC, space-separated);
    clip `created_at` is proper ISO with a trailing Z. Normalise both. */
function toTime(raw: unknown): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const iso = s.includes("T") ? s : `${s.replace(" ", "T")}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function mapClip(raw: Record<string, unknown>, slug: string): RvxMediaItem | null {
  const id = String(raw.id ?? "");
  const hlsUrl = (raw.video_url as string) || (raw.clip_url as string) || null;
  if (!id || !hlsUrl) return null;
  const time = toTime(raw.created_at);
  const channel = (raw.channel ?? {}) as Record<string, unknown>;
  return {
    id,
    kind: "clip",
    title: (raw.title as string)?.trim() || "Untitled clip",
    channelSlug: slug,
    channelName: CREW_NAME[slug] || (channel.username as string) || slug,
    time,
    date: mdy(new Date(time)),
    durationSec: num(raw.duration),
    views: num(raw.view_count ?? raw.views),
    mature: Boolean(raw.is_mature),
    thumbnail: (raw.thumbnail_url as string) || null,
    hlsUrl,
    embedUrl: `https://player.kick.com/clip/${encodeURIComponent(id)}`,
    watchUrl: `https://kick.com/${slug}/clips/${encodeURIComponent(id)}`,
  };
}

function mapVod(raw: Record<string, unknown>, slug: string): RvxMediaItem | null {
  // The `is_live` entry is the CURRENT livestream, not a finished VOD.
  if (raw.is_live) return null;
  const video = (raw.video ?? {}) as Record<string, unknown>;
  const uuid = (video.uuid as string) || "";
  if (!uuid) return null;
  const thumb = (raw.thumbnail ?? {}) as Record<string, unknown>;
  const time = toTime(raw.created_at ?? raw.start_time);
  return {
    id: `vod_${uuid}`,
    kind: "vod",
    title: (raw.session_title as string)?.trim() || "Untitled broadcast",
    channelSlug: slug,
    channelName: CREW_NAME[slug] || slug,
    time,
    date: mdy(new Date(time)),
    durationSec: num(raw.duration) / 1000, // Kick reports VOD duration in ms
    views: num(raw.views),
    mature: Boolean(raw.is_mature),
    thumbnail: (thumb.src as string) || null,
    hlsUrl: null, // stream.kick.com has no CORS → official embed only
    embedUrl: `https://player.kick.com/video/${encodeURIComponent(uuid)}`,
    watchUrl: `https://kick.com/${slug}/videos/${encodeURIComponent(uuid)}`,
  };
}

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { mode: "cors", headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`kick ${r.status}`);
  return r.json();
}

async function fetchClips(slug: string): Promise<RvxMediaItem[]> {
  const j = (await getJson(
    `${BASE}${encodeURIComponent(slug)}/clips?cursor=0&sort=date&time=all`,
  )) as { clips?: Record<string, unknown>[] };
  const clips = Array.isArray(j.clips) ? j.clips : [];
  return clips.map((c) => mapClip(c, slug)).filter((m): m is RvxMediaItem => Boolean(m));
}

async function fetchVods(slug: string): Promise<RvxMediaItem[]> {
  const j = (await getJson(`${BASE}${encodeURIComponent(slug)}/videos`)) as unknown;
  const vids = Array.isArray(j) ? (j as Record<string, unknown>[]) : [];
  return vids.map((v) => mapVod(v, slug)).filter((m): m is RvxMediaItem => Boolean(m));
}

export type MediaResult = { clips: RvxMediaItem[]; vods: RvxMediaItem[] };

// Module-level cache so switching hub tabs (which remounts the tab) doesn't
// refetch the whole crew every time within a session.
let cache: MediaResult | null = null;
let inflight: Promise<MediaResult> | null = null;

/** Fetch clips + VODs for every active crew channel, in parallel and fault-
    tolerant: a channel that 404s (temporary ban) or rate-limits just drops out,
    the rest still populate. Newest first. A successful result is cached for the
    session; the shared fetch is deliberately not tied to any one caller's abort
    signal (callers guard their own setState), so a component unmount can't
    poison the cache for the next mount. */
export async function fetchActiveCrewMedia(): Promise<MediaResult> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const tasks = ACTIVE_CREW.flatMap(({ slug }) => [
      fetchClips(slug).catch(() => [] as RvxMediaItem[]),
      fetchVods(slug).catch(() => [] as RvxMediaItem[]),
    ]);
    const all = (await Promise.all(tasks)).flat();
    const byTime = (a: RvxMediaItem, b: RvxMediaItem) => b.time - a.time;
    const result: MediaResult = {
      clips: all.filter((m) => m.kind === "clip").sort(byTime),
      vods: all.filter((m) => m.kind === "vod").sort(byTime),
    };
    // Only cache a real result — an all-empty outcome (offline / rate-limited)
    // stays uncached so the next mount retries instead of showing nothing.
    if (result.clips.length || result.vods.length) cache = result;
    return result;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
