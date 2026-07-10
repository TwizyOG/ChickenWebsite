import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isTenorMediaUrl } from "@/lib/tenor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 5_000;
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { post_id?: unknown; parent_id?: unknown; body?: unknown; gif_url?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const postId = String(raw.post_id ?? "");
  const parentId = raw.parent_id == null ? null : String(raw.parent_id);
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const gifUrl = typeof raw.gif_url === "string" ? raw.gif_url.trim() : "";
  if (!UUID.test(postId) || (parentId !== null && !UUID.test(parentId))) {
    return jsonError(400, "bad_request", "Invalid ids.");
  }
  if (gifUrl && !isTenorMediaUrl(gifUrl)) {
    return jsonError(400, "bad_gif", "GIFs must come from the Tenor picker.");
  }
  if ((!body && !gifUrl) || body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Comment must be 1-${MAX_BODY} characters (or a GIF).`);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data, error } = await admin.rpc("create_comment", {
    p_author: caller.profile.id,
    p_post: postId,
    p_parent: parentId,
    p_body: body || null,
    p_gif_url: gifUrl || null,
  });
  if (error) {
    if (error.message.includes("post_not_found")) {
      return jsonError(404, "not_found", "Post not found.");
    }
    if (error.message.includes("parent_not_found")) {
      return jsonError(400, "bad_parent", "That comment is gone.");
    }
    if (error.message.includes("max_depth")) {
      return jsonError(400, "max_depth", "Thread is too deep — reply higher up.");
    }
    return jsonError(500, "db_error", error.message);
  }
  return Response.json(data);
}
