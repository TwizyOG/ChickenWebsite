/* Kick/Twitch clip link parsing + official embed URLs.
   Kick's official clip player (player.kick.com/clip/{id}) is the same embed
   the RVX hub uses (src/lib/rvxMedia.ts) — no undocumented endpoints. */

export type ParsedClip = { provider: "kick" | "twitch"; id: string; url: string };

const ID = /^[A-Za-z0-9_-]+$/;

export function parseClipUrl(raw: string): ParsedClip | null {
  const input = (raw ?? "").trim();
  if (!input) return null;
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "kick.com") {
    const q = u.searchParams.get("clip");
    if (q && ID.test(q)) return { provider: "kick", id: q, url: input };
    if (parts.length === 3 && parts[1] === "clips" && ID.test(parts[2])) {
      return { provider: "kick", id: parts[2], url: input };
    }
    return null;
  }
  if (host === "clips.twitch.tv") {
    if (parts.length === 1 && ID.test(parts[0])) {
      return { provider: "twitch", id: parts[0], url: input };
    }
    return null;
  }
  if (host === "twitch.tv") {
    if (parts.length === 3 && parts[1] === "clip" && ID.test(parts[2])) {
      return { provider: "twitch", id: parts[2], url: input };
    }
    return null;
  }
  return null;
}

/** Hosts allowed to embed the Twitch player (Twitch requires exact matches). */
const TWITCH_PARENTS = ["chickenwebsite.vercel.app", "twizyog.github.io", "localhost"];

export function twitchClipEmbedUrl(id: string): string {
  const parents = TWITCH_PARENTS.map((p) => `parent=${encodeURIComponent(p)}`).join("&");
  return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(id)}&${parents}&autoplay=false`;
}

export function kickClipEmbedUrl(id: string): string {
  return `https://player.kick.com/clip/${encodeURIComponent(id)}`;
}
