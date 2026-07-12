import { type NextRequest } from "next/server";
import { broadcastPing } from "@/lib/forumRealtime";
import { jsonError, logMod, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** POST { comment_id } → hard-delete a removed LEAF comment (purge its
    "[removed]" tombstone). Admin only; the purge_comment RPC enforces that the
    comment is already removed and childless. */
export async function POST(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  let raw: { comment_id?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const id = String(raw.comment_id ?? "");
  if (!UUID.test(id)) return jsonError(400, "bad_request", "Invalid comment id.");

  // Capture the post id for the live ping before the row is deleted.
  const { data: c } = await admin.from("comments").select("post_id").eq("id", id).maybeSingle();

  const { error } = await admin.rpc("purge_comment", { p_comment: id });
  if (error) {
    if (error.message.includes("not_found")) return jsonError(404, "not_found", "Comment not found.");
    if (error.message.includes("not_removed")) {
      return jsonError(400, "not_removed", "Remove the comment first, then clear the tombstone.");
    }
    if (error.message.includes("has_replies")) {
      return jsonError(400, "has_replies", "This comment has replies — its tombstone has to stay.");
    }
    return jsonError(500, "db_error", error.message);
  }

  await logMod(caller.profile.id, "purge_comment", "comment", id, {});
  if (c?.post_id) {
    try {
      await broadcastPing(`post:${c.post_id}`, "comments", {});
    } catch {
      /* best-effort */
    }
  }
  return Response.json({ ok: true });
}
