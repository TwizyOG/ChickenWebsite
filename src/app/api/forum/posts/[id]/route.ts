import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 10_000;

async function ownPost(req: NextRequest, id: string) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: post, error } = await admin
    .from("posts")
    .select("id, author_id, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!post || post.removed_at) return jsonError(404, "not_found", "Post not found.");
  if (post.author_id !== caller.profile.id) {
    return jsonError(403, "not_yours", "You can only change your own posts.");
  }
  return { caller, admin };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownPost(req, id);
  if (own instanceof Response) return own;
  const bannedRes = bannedResponse(own.caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { body?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Body is limited to ${MAX_BODY} characters.`);
  }

  const { error } = await own.admin
    .from("posts")
    .update({ body: body || null, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownPost(req, id);
  if (own instanceof Response) return own;

  const { error } = await own.admin
    .from("posts")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: own.caller.profile.id,
      removal_reason: "author",
    })
    .eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  return Response.json({ ok: true });
}
