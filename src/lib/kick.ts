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
    const raw = sessionStorage.getItem(`kick:${slug}`);
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
    sessionStorage.setItem(`kick:${slug}`, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* quota — fine */
  }
}

export async function fetchKickChannel(
  slug: string,
  signal?: AbortSignal,
): Promise<LiveData> {
  const cached = readCache(slug);
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

    const data: LiveData = {
      slug,
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
      followers: typeof j.followers_count === "number" ? (j.followers_count as number) : null,
      bio: (user.bio as string) ?? null,
      socials: socialLinks(user, slug),
    };
    writeCache(slug, data);
    return data;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    return { ...emptyLive(slug), loaded: true, failed: true };
  }
}

/** Hydrate many channels with a bounded worker pool; calls onEach as each lands. */
export async function hydratePool(
  slugs: string[],
  onEach: (data: LiveData) => void,
  { concurrency = 6, signal }: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const queue = [...slugs];
  const worker = async () => {
    while (queue.length) {
      if (signal?.aborted) return;
      const slug = queue.shift();
      if (!slug) return;
      try {
        const data = await fetchKickChannel(slug, signal);
        if (!signal?.aborted) onEach(data);
      } catch {
        /* aborted or failed — skip */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, slugs.length) }, worker));
}

/** Compact viewer/follower formatting: 1200 → "1.2K", 1_500_000 → "1.5M". */
export function fmtCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
