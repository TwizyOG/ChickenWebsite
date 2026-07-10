import { type NextRequest } from "next/server";
import { jsonError } from "@/lib/forumApi";
import { mapTenorResults } from "@/lib/tenor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q=… → { results: GifResult[] }. Public read; the Tenor key stays here. */
export async function GET(req: NextRequest) {
  const key = process.env.TENOR_API_KEY;
  if (!key) {
    return jsonError(501, "not_configured", "GIF search isn't configured yet.");
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return jsonError(400, "bad_query", "Type something to search.");

  const url =
    `https://tenor.googleapis.com/v2/search?key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(q)}&limit=24&media_filter=gif,tinygif&contentfilter=medium` +
    `&client_key=chickenandy-forum`;
  let j: unknown;
  try {
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) return jsonError(502, "tenor_error", `Tenor answered ${r.status}.`);
    j = await r.json();
  } catch {
    return jsonError(502, "tenor_error", "Couldn't reach Tenor.");
  }
  return Response.json(
    { results: mapTenorResults(j) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
