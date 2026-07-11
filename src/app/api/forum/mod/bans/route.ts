import { type NextRequest } from "next/server";
import { jsonError, logMod, requireRole, roleRank } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { kick_id, reason?, days? } — ban. Mods can't touch mods/admins;
    admins can ban mods; nobody bans admins. */
export async function POST(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  let raw: { kick_id?: unknown; reason?: unknown; days?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const kickId = Number(raw.kick_id);
  const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, 500) : "";
  const days = Number(raw.days);
  if (!Number.isFinite(kickId) || kickId <= 0) return jsonError(400, "bad_user", "Invalid user.");

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: target } = await admin
    .from("profiles")
    .select("id, username, role")
    .eq("kick_id", kickId)
    .maybeSingle();
  if (!target) return jsonError(404, "not_found", "No such forum user.");
  if (target.id === caller.profile.id) {
    return jsonError(400, "bad_target", "You can't ban yourself.");
  }
  if (
    target.role === "admin" ||
    roleRank(target.role as "user" | "moderator" | "admin") >= roleRank(caller.profile.role)
  ) {
    return jsonError(403, "forbidden", "You can't ban that user.");
  }

  const expires =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : null;
  const { data: ban, error } = await admin
    .from("bans")
    .insert({
      profile_id: target.id,
      issued_by: caller.profile.id,
      reason: reason || null,
      expires_at: expires,
    })
    .select("id")
    .single();
  if (error) return jsonError(500, "db_error", error.message);
  await logMod(caller.profile.id, "ban", "profile", String(kickId), {
    username: target.username,
    reason: reason || null,
    days: expires ? days : null,
  });
  return Response.json({ id: ban.id });
}

/** DELETE { ban_id } — lift an active ban. */
export async function DELETE(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  let raw: { ban_id?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const banId = Number(raw.ban_id);
  if (!Number.isInteger(banId)) return jsonError(400, "bad_ban", "Invalid ban.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data, error } = await admin
    .from("bans")
    .update({ lifted_at: new Date().toISOString(), lifted_by: caller.profile.id })
    .eq("id", banId)
    .is("lifted_at", null)
    .select("id, profile_id")
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "No active ban with that id.");
  await logMod(caller.profile.id, "unban", "ban", String(banId));
  return Response.json({ ok: true });
}

/** GET — active bans list (mod+). */
export async function GET(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: bans, error } = await admin
    .from("bans")
    .select("id, profile_id, reason, expires_at, created_at, issued_by")
    .is("lifted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return jsonError(500, "db_error", error.message);
  const ids = [...new Set((bans ?? []).flatMap((b) => [b.profile_id, b.issued_by]))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, username, kick_id").in("id", ids)
    : { data: [] as { id: string; username: string; kick_id: number }[] };
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return Response.json({
    bans: (bans ?? []).map((b) => ({
      id: b.id,
      username: byId.get(b.profile_id as string)?.username ?? "?",
      kick_id: byId.get(b.profile_id as string)?.kick_id ?? null,
      reason: b.reason,
      expires_at: b.expires_at,
      created_at: b.created_at,
      issued_by: byId.get(b.issued_by as string)?.username ?? "?",
    })),
  });
}
