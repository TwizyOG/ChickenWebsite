import { type NextRequest } from "next/server";
import { getSession, requireCaller } from "@/lib/forumApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!getSession(req)) return Response.json({ signedOut: true });
  const caller = await requireCaller(req);
  if (caller instanceof Response) return Response.json({ signedOut: true });
  const { profile, ban } = caller;
  return Response.json({
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
}
