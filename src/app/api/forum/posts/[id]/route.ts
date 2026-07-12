import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, logMod, notify, requireCaller, roleRank } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { broadcastPing } from "@/lib/forumRealtime";

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
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: post, error } = await admin
    .from("posts")
    .select("id, author_id, title, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!post || post.removed_at) return jsonError(404, "not_found", "Post not found.");

  const own = post.author_id === caller.profile.id;
  const isMod = roleRank(caller.profile.role) >= roleRank("moderator");
  if (!own && !isMod) return jsonError(403, "not_yours", "You can only delete your own posts.");

  let reason = "author";
  if (!own) {
    const raw = (await req.json().catch(() => ({}))) as { reason?: unknown };
    reason =
      typeof raw.reason === "string" && raw.reason.trim()
        ? raw.reason.trim().slice(0, 500)
        : "removed by moderators";
  }
  const { error: updError } = await admin
    .from("posts")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: caller.profile.id,
      removal_reason: reason,
    })
    .eq("id", id);
  if (updError) return jsonError(500, "db_error", updError.message);

  // Removal resolves any open reports on this content (best-effort).
  try {
    await admin
      .from("reports")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: caller.profile.id,
        resolution: "removed",
      })
      .eq("subject_type", "post")
      .eq("subject_id", id)
      .is("resolved_at", null);
  } catch {
    /* best-effort */
  }

  if (!own) {
    await logMod(caller.profile.id, "remove_post", "post", id, { title: post.title, reason });
    await notify(post.author_id as string, "mod_remove_post", caller.profile.id, id, null, {
      post_title: post.title,
      reason,
    });
    try {
      const { data: author } = await admin
        .from("profiles")
        .select("kick_id")
        .eq("id", post.author_id)
        .maybeSingle();
      if (author) await broadcastPing(`user:${author.kick_id}`, "notif", {});
    } catch {
      /* best-effort */
    }
  }
  await broadcastPing(`post:${id}`, "removed", {});
  return Response.json({ ok: true });
}
