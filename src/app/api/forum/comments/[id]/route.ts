import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, logMod, notify, requireCaller, roleRank } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { broadcastPing } from "@/lib/forumRealtime";

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
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: comment, error } = await admin
    .from("comments")
    .select("id, author_id, body, post_id, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!comment || comment.removed_at) return jsonError(404, "not_found", "Comment not found.");

  const own = comment.author_id === caller.profile.id;
  const isMod = roleRank(caller.profile.role) >= roleRank("moderator");
  if (!own && !isMod) {
    return jsonError(403, "not_yours", "You can only delete your own comments.");
  }

  let reason = "author";
  if (!own) {
    const raw = (await req.json().catch(() => ({}))) as { reason?: unknown };
    reason =
      typeof raw.reason === "string" && raw.reason.trim()
        ? raw.reason.trim().slice(0, 500)
        : "removed by moderators";
  }
  const { error: updError } = await admin
    .from("comments")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: caller.profile.id,
      removal_reason: reason,
    })
    .eq("id", id);
  if (updError) return jsonError(500, "db_error", updError.message);
  if (!own) {
    await logMod(caller.profile.id, "remove_comment", "comment", id, {
      body: (comment.body as string | null)?.slice(0, 80) ?? null,
      reason,
    });
    await notify(
      comment.author_id as string,
      "mod_remove_comment",
      caller.profile.id,
      comment.post_id as string,
      id,
      { excerpt: (comment.body as string | null)?.slice(0, 140) ?? "[gif]", reason },
    );
    try {
      const { data: author } = await admin
        .from("profiles")
        .select("kick_id")
        .eq("id", comment.author_id)
        .maybeSingle();
      if (author) await broadcastPing(`user:${author.kick_id}`, "notif", {});
    } catch {
      /* best-effort */
    }
  }
  await broadcastPing(`post:${comment.post_id}`, "comments", {});
  return Response.json({ ok: true });
}
