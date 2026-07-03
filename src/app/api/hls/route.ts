import { type NextRequest } from "next/server";

/* =============================================================================
   HLS master-manifest CORS shim.

   Kick's live streams are IVS. Their public `playback_url` (the *master*
   playlist on `*.playback.live-video.net`) is the ONE piece that returns no
   `Access-Control-Allow-Origin`, so a browser on our origin can't read it —
   which is why hls.js can't start. Everything the master points at (the
   per-rendition media playlists on `*.playlist.live-video.net` and the video
   segments) already serves `Access-Control-Allow-Origin: *`, so once hls.js has
   the master it loads all the heavy video data browser-direct from Kick's CDN.

   This route therefore only relays the ~2 KB master text once per stream open,
   re-served with permissive CORS. No video bytes flow through us — it's a
   minimal same-origin shim for a manifest pointer, keeping the "the visitor's
   own browser pulls the stream straight from Kick" model intact. The master's
   variant URLs are absolute, so no rewriting is needed.

   Only *.live-video.net targets are allowed (no open proxy / SSRF). Serverless
   only — the static GitHub Pages export strips /api, so that build points the
   player at this same route on the Vercel deployment instead. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOST = /(^|\.)live-video\.net$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new Response("missing u", { status: 400, headers: CORS });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400, headers: CORS });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) {
    return new Response("forbidden host", { status: 403, headers: CORS });
  }

  try {
    const upstream = await fetch(target.toString(), {
      // Server-side fetch: CORS doesn't apply, so IVS serves the master bytes.
      headers: {
        accept: "application/vnd.apple.mpegurl,*/*",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new Response(`upstream ${upstream.status}`, {
        status: upstream.status === 404 ? 404 : 502,
        headers: CORS,
      });
    }

    const body = await upstream.text();
    return new Response(body, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/vnd.apple.mpegurl",
        // Master rotates its signed variant URLs; keep it uncached.
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502, headers: CORS });
  }
}
