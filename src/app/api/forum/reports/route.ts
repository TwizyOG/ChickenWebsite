import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = new Set(["spam", "harassment", "nsfw", "misinfo", "other"]);
const UUID = /^[0-9a-f-]{36}$/i;
const MAX_DETAIL = 500;
const MAX_OPEN = 25;

/** POST { subject_type, subject_id, reason, detail? } → {ok} | {already}. */
export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { subject_type?: unknown; subject_id?: unknown; reason?: unknown; detail?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const type = String(raw.subject_type ?? "");
  const id = String(raw.subject_id ?? "");
  const reason = String(raw.reason ?? "");
  const detail = typeof raw.detail === "string" ? raw.detail.trim().slice(0, MAX_DETAIL) : "";
  if (!["post", "comment"].includes(type) || !UUID.test(id) || !REASONS.has(reason)) {
    return jsonError(400, "bad_request", "Invalid report.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const table = type === "post" ? "posts" : "comments";
  const { data: subject, error: subjErr } = await admin
    .from(table)
    .select("id, author_id, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (subjErr) return jsonError(500, "db_error", subjErr.message);
  if (!subject || subject.removed_at) return jsonError(404, "not_found", "That content is gone.");
  if (subject.author_id === caller.profile.id) {
    return jsonError(400, "own_content", "You can't report your own content.");
  }

  const { count } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", caller.profile.id)
    .is("resolved_at", null);
  if ((count ?? 0) >= MAX_OPEN) {
    return jsonError(429, "too_many_reports", "You have a lot of open reports — the mods are on it.");
  }

  const { error } = await admin.from("reports").insert({
    reporter_id: caller.profile.id,
    subject_type: type,
    subject_id: id,
    reason,
    detail: detail || null,
  });
  if (error) {
    if (error.code === "23505") return Response.json({ already: true }); // open-report dedupe
    return jsonError(500, "db_error", error.message);
  }
  return Response.json({ ok: true });
}
