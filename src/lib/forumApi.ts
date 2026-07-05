import { type NextRequest } from "next/server";
import { FORUM_SESSION_COOKIE, type ForumSession, verifyForumSession } from "@/lib/forumSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/* Shared plumbing for /api/forum/* write routes. The session cookie only
   authenticates identity — role and ban status always come from the DB. */

export type CallerProfile = {
  id: string;
  kick_id: number;
  username: string;
  avatar_url: string | null;
  role: "user" | "moderator" | "admin";
  post_karma: number;
  comment_karma: number;
  created_at: string;
};

export type ActiveBan = { reason: string | null; expires_at: string | null } | null;

export type Caller = { session: ForumSession; profile: CallerProfile; ban: ActiveBan };

export function jsonError(
  status: number,
  code: string,
  error: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ code, error, ...extra }, { status });
}

export function getSession(req: NextRequest): ForumSession | null {
  const secret = process.env.FORUM_SESSION_SECRET;
  if (!secret) return null;
  return verifyForumSession(req.cookies.get(FORUM_SESSION_COOKIE)?.value, secret);
}

/** Resolve session → DB profile + active ban; a Response means "reply with this". */
export async function requireCaller(req: NextRequest): Promise<Caller | Response> {
  const session = getSession(req);
  if (!session) return jsonError(401, "signed_out", "Sign in with Kick to do that.");

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, kick_id, username, avatar_url, role, post_karma, comment_karma, created_at")
    .eq("kick_id", session.kickId)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!profile) {
    return jsonError(401, "no_profile", "Sign in with Kick again to set up your forum profile.");
  }

  const { data: bans } = await admin
    .from("bans")
    .select("reason, expires_at")
    .eq("profile_id", profile.id)
    .is("lifted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1);

  return {
    session,
    profile: profile as CallerProfile,
    ban: (bans?.[0] as ActiveBan) ?? null,
  };
}

/** 403 response when the caller is banned, else null. */
export function bannedResponse(ban: ActiveBan): Response | null {
  if (!ban) return null;
  return jsonError(403, "banned", "You are banned from the community forum.", { ban });
}
