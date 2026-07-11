import { type NextRequest } from "next/server";
import { jsonError, logMod, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set(["user", "moderator", "admin"]);

/** POST { kick_id, role } — admin only; the last admin can't demote themself. */
export async function POST(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  let raw: { kick_id?: unknown; role?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const kickId = Number(raw.kick_id);
  const role = String(raw.role ?? "");
  if (!Number.isFinite(kickId) || !ROLES.has(role)) {
    return jsonError(400, "bad_request", "Invalid user or role.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: target } = await admin
    .from("profiles")
    .select("id, username, role")
    .eq("kick_id", kickId)
    .maybeSingle();
  if (!target) return jsonError(404, "not_found", "No such forum user.");

  if (target.id === caller.profile.id && role !== "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) return jsonError(400, "last_admin", "You're the last admin.");
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", target.id);
  if (error) return jsonError(500, "db_error", error.message);
  await logMod(caller.profile.id, "set_role", "profile", String(kickId), {
    username: target.username,
    from: target.role,
    to: role,
  });
  return Response.json({ ok: true });
}
