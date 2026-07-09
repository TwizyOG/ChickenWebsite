import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 5_000;

async function ownComment(req: NextRequest, id: string) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: comment, error } = await admin
    .from("comments")
    .select("id, author_id, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!comment || comment.removed_at) return jsonError(404, "not_found", "Comment not found.");
  if (comment.author_id !== caller.profile.id) {
    return jsonError(403, "not_yours", "You can only change your own comments.");
  }
  return { caller, admin };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownComment(req, id);
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
  if (!body || body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Comment must be 1-${MAX_BODY} characters.`);
  }

  const { error } = await own.admin
    .from("comments")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);

  const { data: row } = await own.admin.from("comments_thread").select("*").eq("id", id).single();
  return Response.json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownComment(req, id);
  if (own instanceof Response) return own;

  const { error } = await own.admin
    .from("comments")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: own.caller.profile.id,
      removal_reason: "author",
    })
    .eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  return Response.json({ ok: true });
}
