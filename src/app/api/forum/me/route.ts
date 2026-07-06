import { NextResponse, type NextRequest } from "next/server";
import {
  FORUM_SESSION_COOKIE_OPTS,
  establishForumSession,
  getSession,
  loadCaller,
} from "@/lib/forumApi";
import { FORUM_SESSION_COOKIE } from "@/lib/forumSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let session = getSession(req);
  let healedCookie: string | null = null;

  // Self-heal: signed in with Kick but no forum cookie (session predates the
  // forum, or the env vars landed after login) → mint it now, no re-login.
  if (!session) {
    const kickToken = req.cookies.get("kick_token")?.value;
    if (kickToken) {
      const healed = await establishForumSession(kickToken);
      if (healed) {
        session = healed.session;
        healedCookie = healed.cookieValue;
      }
    }
  }
  if (!session) return Response.json({ signedOut: true });

  const caller = await loadCaller(session);
  if (caller instanceof Response) return Response.json({ signedOut: true });
  const { profile, ban } = caller;

  const res = NextResponse.json({
    profile: {
      id: profile.id,
      kickId: profile.kick_id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      role: profile.role,
      postKarma: profile.post_karma,
      commentKarma: profile.comment_karma,
      createdAt: profile.created_at,
    },
    ban,
  });
  if (healedCookie) res.cookies.set(FORUM_SESSION_COOKIE, healedCookie, FORUM_SESSION_COOKIE_OPTS);
  return res;
}
