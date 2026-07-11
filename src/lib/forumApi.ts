import { type NextRequest } from "next/server";
import {
  FORUM_SESSION_COOKIE,
  FORUM_SESSION_MAX_AGE,
  type ForumSession,
  signForumSession,
  verifyForumSession,
} from "@/lib/forumSession";
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
  return loadCaller(session);
}

/** DB half of requireCaller — usable with a freshly healed session too. */
export async function loadCaller(session: ForumSession): Promise<Caller | Response> {
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

const ROLE_RANK: Record<CallerProfile["role"], number> = { user: 0, moderator: 1, admin: 2 };

/** requireCaller + minimum role. */
export async function requireRole(
  req: NextRequest,
  min: "moderator" | "admin",
): Promise<Caller | Response> {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  if (ROLE_RANK[caller.profile.role] < ROLE_RANK[min]) {
    return jsonError(403, "forbidden", `That needs the ${min} role.`);
  }
  return caller;
}

export function roleRank(role: CallerProfile["role"]): number {
  return ROLE_RANK[role];
}

/** Append-only audit trail — best-effort, never blocks the action. */
export async function logMod(
  actorId: string,
  action: string,
  subjectType: string | null,
  subjectId: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    await admin.from("mod_log").insert({
      actor_id: actorId,
      action,
      subject_type: subjectType,
      subject_id: subjectId,
      detail: detail ?? null,
    });
  } catch {
    /* audit is best-effort */
  }
}

export type NotificationKind =
  | "reply_post"
  | "reply_comment"
  | "mod_remove_post"
  | "mod_remove_comment";

/** Best-effort notification insert — never blocks the action (like logMod). */
export async function notify(
  profileId: string,
  kind: NotificationKind,
  actorId: string | null,
  postId: string | null,
  commentId: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    await admin.from("notifications").insert({
      profile_id: profileId,
      kind,
      actor_id: actorId,
      post_id: postId,
      comment_id: commentId,
      detail: detail ?? null,
    });
  } catch {
    /* best-effort */
  }
}

export const FORUM_SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: FORUM_SESSION_MAX_AGE,
} as const;

/** Self-heal: mint a forum_session (+ ensure the profile row) from a live Kick
    access token. Covers sessions created before the forum env vars existed —
    the user stays signed in with Kick but has no forum cookie yet. */
export async function establishForumSession(
  accessToken: string,
): Promise<{ cookieValue: string; session: ForumSession } | null> {
  const secret = process.env.FORUM_SESSION_SECRET;
  if (!secret || !accessToken) return null;
  try {
    const r = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const u = j?.data?.[0] ?? {};
    const rawId = Number(u.user_id);
    const kickId = Number.isFinite(rawId) && rawId > 0 ? rawId : null;
    if (!kickId) return null;
    const username: string = u.name || u.username || "Kick user";
    const avatar: string | null =
      typeof u.profile_picture === "string" && u.profile_picture ? u.profile_picture : null;

    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        const adminIds = (process.env.FORUM_ADMIN_KICK_IDS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const { data: existing } = await admin
          .from("profiles")
          .select("role")
          .eq("kick_id", kickId)
          .maybeSingle();
        const role = adminIds.includes(String(kickId)) ? "admin" : existing?.role ?? "user";
        await admin
          .from("profiles")
          .upsert({ kick_id: kickId, username, avatar_url: avatar, role }, { onConflict: "kick_id" });
      } catch {
        /* profile can sync on a later request */
      }
    }

    const now = Date.now();
    const iat = Math.floor(now / 1000);
    return {
      cookieValue: signForumSession({ kickId, username, avatar }, secret, now),
      session: { kickId, username, avatar, iat, exp: iat + FORUM_SESSION_MAX_AGE },
    };
  } catch {
    return null;
  }
}
