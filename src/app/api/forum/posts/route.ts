import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 300;
const MAX_BODY = 10_000;

/* v1: text posts. Media attachments + clip embeds land in plan 03, which
   extends this handler — keep the shape { title, flair_id, body }. */

export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { title?: unknown; flair_id?: unknown; body?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const flairId = Number(raw.flair_id);

  if (!title || title.length > MAX_TITLE) {
    return jsonError(400, "bad_title", `Title must be 1-${MAX_TITLE} characters.`);
  }
  if (body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Body is limited to ${MAX_BODY} characters.`);
  }
  if (!Number.isInteger(flairId) || flairId <= 0) {
    return jsonError(400, "bad_flair", "Pick a flair.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data: flair } = await admin.from("flairs").select("id").eq("id", flairId).maybeSingle();
  if (!flair) return jsonError(400, "bad_flair", "That flair doesn't exist.");

  const { data, error } = await admin
    .from("posts")
    .insert({
      author_id: caller.profile.id,
      flair_id: flairId,
      title,
      body: body || null,
      kind: "text",
    })
    .select("id")
    .single();
  if (error) return jsonError(500, "db_error", error.message);

  return Response.json({ id: data.id });
}
