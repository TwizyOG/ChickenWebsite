import { type LiveData, type Social, emptyLive } from "./types";

/* =============================================================================
   Live Kick hydration — client-side, CORS-permitting, keyless.
   Generalised from the RV X site's kick.js. Every channel degrades gracefully:
   a failed fetch (offline / Cloudflare / rate-limit) just keeps the roster entry
   with loaded=false so the card shows a name-only fallback instead of breaking.
   No scraping, no captcha-solving, no proxy — the visitor's own browser asks
   Kick's public endpoint the same way kick.com's own site does.
   ========================================================================== */

const BASE = "https://kick.com/api/v2/channels/";
const CACHE_TTL = 60_000; // 60s — avoid refetch storms on client navigation
const CACHE_PREFIX = "kick2:"; // bump when LiveData gains fields (schema change)

const clean = (v: unknown) =>
  String(v ?? "")
    .trim()
    .replace(/^@/, "");

function socialLinks(user: Record<string, unknown>, slug: string): Social[] {
  const links: Social[] = [{ platform: "kick", href: `https://kick.com/${slug}` }];
  if (user.instagram)
    links.push({ platform: "instagram", href: `https://instagram.com/${clean(user.instagram)}` });
  if (user.twitter)
    links.push({ platform: "x", href: `https://x.com/${clean(user.twitter)}` });
  if (user.youtube)
    links.push({ platform: "youtube", href: `https://youtube.com/@${clean(user.youtube)}` });
  if (user.tiktok)
    links.push({ platform: "tiktok", href: `https://tiktok.com/@${clean(user.tiktok)}` });
  if (user.discord)
    links.push({ platform: "discord", href: `https://discord.gg/${clean(user.discord)}` });
  return links;
}

function readCache(slug: string): LiveData | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${slug}`);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL) return null;
    return data as LiveData;
  } catch {
    return null;
  }
}

function writeCache(slug: string, data: LiveData) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* quota — fine */
  }
}

/** The usable live thumbnail. The main channels endpoint only gives a private
    `stream.kick.com` URL (403s off-site); the dedicated livestream endpoint
    returns a hotlinkable `images.kick.com` frame in `data.thumbnail.src`. */
async function fetchLiveThumb(slug: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}${encodeURIComponent(slug)}/livestream`, {
      mode: "cors",
      signal,
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { thumbnail?: { src?: string } } | null };
    return j?.data?.thumbnail?.src ?? null;
  } catch {
    return null;
  }
}

export async function fetchKickChannel(
  slug: string,
  signal?: AbortSignal,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<LiveData> {
  // `fresh` skips the session cache — used to re-mint an expired playback token.
  const cached = fresh ? null : readCache(slug);
  if (cached) return cached;

  try {
    const r = await fetch(`${BASE}${encodeURIComponent(slug)}`, {
      mode: "cors",
      signal,
      headers: { accept: "application/json" },
    });
    if (!r.ok) throw new Error(`kick ${r.status}`);
    const j = (await r.json()) as Record<string, unknown>;

    const user = (j.user ?? {}) as Record<string, unknown>;
    const ls = (j.livestream ?? null) as Record<string, unknown> | null;
    const cats = Array.isArray(ls?.categories) ? (ls!.categories as Record<string, unknown>[]) : [];
    const recent = Array.isArray(j.recent_categories)
      ? (j.recent_categories as Record<string, unknown>[])
      : [];
    const thumb = (ls?.thumbnail ?? null) as Record<string, unknown> | null;
    const bannerImg = (j.banner_image ?? null) as Record<string, unknown> | null;
    const chatroom = (j.chatroom ?? null) as Record<string, unknown> | null;
    const subBadgesRaw = Array.isArray(j.subscriber_badges)
      ? (j.subscriber_badges as Record<string, unknown>[])
      : [];

    const data: LiveData = {
      slug,
      username: (user.username as string) || null,
      loaded: true,
      live: Boolean(ls && (ls.is_live ?? true)),
      viewers: Number(ls?.viewer_count ?? 0),
      title: (ls?.session_title as string) ?? null,
      category: (cats[0]?.name as string) ?? null,
      categoryHistory: recent.map((c) => c.name as string).filter(Boolean).slice(0, 6),
      mature: Boolean(ls?.is_mature),
      verified: Boolean(j.verified),
      avatar: (user.profile_pic as string) ?? null,
      thumbnail: (thumb?.url as string) ?? null,
      liveThumbnail: null,
      banner: (bannerImg?.url as string) ?? null,
      followers: typeof j.followers_count === "number" ? (j.followers_count as number) : null,
      bio: (user.bio as string) ?? null,
      socials: socialLinks(user, slug),
      playbackUrl: (j.playback_url as string) ?? null,
      chatroomId: typeof chatroom?.id === "number" ? (chatroom.id as number) : null,
      subBadges: subBadgesRaw
        .map((b) => ({
          months: Number(b.months ?? 0),
          src: String(((b.badge_image ?? {}) as Record<string, unknown>).src ?? ""),
        }))
        .filter((b) => b.src)
        .sort((a, b) => a.months - b.months),
    };
    // Only live channels have a frame — one extra request per live channel
    // (a handful), skipped for the offline majority.
    if (data.live) data.liveThumbnail = await fetchLiveThumb(slug, signal);
    writeCache(slug, data);
    return data;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    return { ...emptyLive(slug), loaded: true, failed: true };
  }
}

/** Hydrate many channels with a bounded worker pool; calls onEach as each lands.
    Failed fetches get two gentler retry rounds — bursting the whole roster can
    trip Kick's rate limiting for a chunk of channels, which is the difference
    between "a couple of fallback cards" and "half the directory shows initials
    instead of real avatars". Only after the retries do failures surface. */
export async function hydratePool(
  slugs: string[],
  onEach: (data: LiveData) => void,
  { concurrency = 6, signal }: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<void> {
  let failed: string[] = [];

  const run = async (list: string[], conc: number) => {
    const queue = [...list];
    const worker = async () => {
      while (queue.length) {
        if (signal?.aborted) return;
        const slug = queue.shift();
        if (!slug) return;
        try {
          const data = await fetchKickChannel(slug, signal);
          if (signal?.aborted) return;
          if (data.failed) failed.push(slug);
          else onEach(data);
        } catch {
          /* aborted — skip */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(conc, list.length) }, worker));
  };

  await run(slugs, concurrency);

  for (const delay of [1500, 4000]) {
    if (signal?.aborted || failed.length === 0) break;
    await new Promise((r) => setTimeout(r, delay));
    const round = failed;
    failed = [];
    await run(round, 3);
  }

  // Whatever still failed is delivered as-is so cards show the fallback state.
  if (!signal?.aborted) {
    for (const slug of failed) onEach({ ...emptyLive(slug), loaded: true, failed: true });
  }
}

/** Build the playable master-manifest URL for hls.js from Kick's raw
    `playback_url`. Kick's IVS master is the only stream resource without
    permissive CORS, so it's relayed through our same-origin `/api/hls` shim;
    the media playlists + segments it points at are already `ACAO:*` and load
    browser-direct. On the static Pages export (no server route) this points at
    the Vercel deployment's shim via NEXT_PUBLIC_HLS_PROXY. */
export function hlsMasterUrl(playbackUrl: string): string {
  const base = (process.env.NEXT_PUBLIC_HLS_PROXY || "").replace(/\/$/, "");
  return `${base}/api/hls?u=${encodeURIComponent(playbackUrl)}`;
}

/** Compact viewer/follower formatting: 1200 → "1.2K", 1_500_000 → "1.5M". */
export function fmtCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
