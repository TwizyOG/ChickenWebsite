import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { broadcastPing } from "@/lib/forumRealtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["post", "comment"]);
const UUID = /^[0-9a-f-]{36}$/i;

/** GET ?type=post&ids=a,b,c → { [subject_id]: -1 | 1 } for the caller. */
export async function GET(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;

  const type = req.nextUrl.searchParams.get("type") ?? "";
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID.test(s))
    .slice(0, 100);
  if (!TYPES.has(type) || !ids.length) return jsonError(400, "bad_request", "type + ids required.");

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data, error } = await admin
    .from("votes")
    .select("subject_id, value")
    .eq("profile_id", caller.profile.id)
    .eq("subject_type", type)
    .in("subject_id", ids);
  if (error) return jsonError(500, "db_error", error.message);

  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.subject_id as string] = row.value as number;
  return Response.json(map);
}

/** POST { subject_type, subject_id, value: -1|0|1 } → { new_score, my_vote } */
export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { subject_type?: unknown; subject_id?: unknown; value?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const type = String(raw.subject_type ?? "");
  const id = String(raw.subject_id ?? "");
  const value = Number(raw.value);
  if (!TYPES.has(type) || !UUID.test(id) || ![-1, 0, 1].includes(value)) {
    return jsonError(400, "bad_request", "Invalid vote.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data, error } = await admin.rpc("cast_vote", {
    p_profile: caller.profile.id,
    p_type: type,
    p_id: id,
    p_value: value,
  });
  if (error) {
    if (error.message.includes("not_found")) {
      return jsonError(404, "not_found", "That no longer exists.");
    }
    return jsonError(500, "db_error", error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;

  // Ping the thread the vote lives in (comment votes need the parent post id).
  let postTopicId = id;
  if (type === "comment") {
    const { data: c } = await admin.from("comments").select("post_id").eq("id", id).maybeSingle();
    postTopicId = (c?.post_id as string) ?? "";
  }
  if (postTopicId) await broadcastPing(`post:${postTopicId}`, "votes", {});
  return Response.json(row ?? { new_score: 0, my_vote: value });
}
