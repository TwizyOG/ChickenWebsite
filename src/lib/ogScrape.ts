/* Server-side og:image resolution for link posts. Runs once at post-creation.
   SSRF-guarded: http(s) only, public hostnames only (checked on the request
   URL and again on the post-redirect final URL), 4s timeout, 512KB read cap.
   The HTML parsing is a pure function so it can be unit-tested. */

const MAX_URL = 2048;
const MAX_HTML_BYTES = 512 * 1024;
const TIMEOUT_MS = 4000;

/** True for http(s) URLs whose hostname is not an obvious private/loopback
    target. DNS-rebinding is out of scope — this runs server-side against a
    user-typed article URL, never with credentials. */
export function isSafePublicUrl(raw: string): boolean {
  if (raw.length > MAX_URL) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return false;
  }
  // IPv6 literals ([::1], fc00::/7, fe80::/10) — reject all v6 literals outright.
  if (host.includes(":")) return false;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    ) {
      return false;
    }
  }
  return true;
}

/** Pull og:image / twitter:image out of an HTML head; resolves relative URLs
    against baseUrl. Returns null when nothing usable is found. */
export function extractOgImage(html: string, baseUrl: string): string | null {
  // <meta ... property="og:image" ... content="..."> in either attribute order.
  const metas = html.match(/<meta\s[^>]*>/gi) ?? [];
  const wanted = ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"];
  const found: Record<string, string> = {};
  for (const tag of metas) {
    const key = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (!key || !wanted.includes(key) || found[key]) continue;
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) found[key] = content.trim();
  }
  for (const key of wanted) {
    const raw = found[key];
    if (!raw) continue;
    try {
      const abs = new URL(raw, baseUrl).toString();
      if (abs.length <= MAX_URL && /^https?:\/\//i.test(abs)) return abs;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** Fetch the article and resolve its preview image. Best-effort: any failure
    (unsafe URL, timeout, non-HTML, no og tags) returns null. */
export async function scrapeOgImage(url: string): Promise<string | null> {
  if (!isSafePublicUrl(url)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ChickenWebsiteBot/1.0; +https://chickenwebsite.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!r.ok || !isSafePublicUrl(r.url)) return null;
    const type = r.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("application/xhtml")) return null;

    // Stream at most MAX_HTML_BYTES — og tags live in <head>.
    const reader = r.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    void reader.cancel().catch(() => {});
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      chunks.length === 1 ? chunks[0] : concat(chunks, total),
    );
    return extractOgImage(html, r.url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
