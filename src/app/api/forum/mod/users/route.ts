import { type NextRequest } from "next/server";
import { jsonError, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q= → up to 10 profiles with an active-ban flag (mod+). */
export async function GET(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 50);
  if (!q) return jsonError(400, "bad_query", "Type a username.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, kick_id, username, role, created_at")
    .ilike("username", `%${q.replace(/[%_]/g, "")}%`)
    .limit(10);
  if (error) return jsonError(500, "db_error", error.message);

  const ids = (profiles ?? []).map((p) => p.id);
  const { data: bans } = ids.length
    ? await admin
        .from("bans")
        .select("profile_id")
        .in("profile_id", ids)
        .is("lifted_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    : { data: [] as { profile_id: string }[] };
  const bannedSet = new Set((bans ?? []).map((b) => b.profile_id as string));

  return Response.json({
    users: (profiles ?? []).map((p) => ({
      kick_id: p.kick_id,
      username: p.username,
      role: p.role,
      banned: bannedSet.has(p.id as string),
    })),
  });
}
