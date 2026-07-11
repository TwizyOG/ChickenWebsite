import { type NextRequest } from "next/server";
import { jsonError, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET (mod+): recently removed posts/comments + recent mod_log, with usernames. */
export async function GET(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const [posts, comments, log, profiles] = await Promise.all([
    admin
      .from("posts")
      .select("id, title, removal_reason, removed_at, removed_by, author_id")
      .not("removed_at", "is", null)
      .order("removed_at", { ascending: false })
      .limit(30),
    admin
      .from("comments")
      .select("id, post_id, body, removal_reason, removed_at, removed_by, author_id")
      .not("removed_at", "is", null)
      .order("removed_at", { ascending: false })
      .limit(50),
    admin.from("mod_log").select("*").order("created_at", { ascending: false }).limit(50),
    admin.from("profiles").select("id, username"),
  ]);
  const name = new Map((profiles.data ?? []).map((p) => [p.id as string, p.username as string]));
  const withNames = <
    T extends { author_id?: string; removed_by?: string | null; actor_id?: string },
  >(
    rows: T[] | null,
  ) =>
    (rows ?? []).map((r) => ({
      ...r,
      author_username: r.author_id ? (name.get(r.author_id) ?? "?") : undefined,
      removed_by_username: r.removed_by ? (name.get(r.removed_by) ?? "?") : undefined,
      actor_username: r.actor_id ? (name.get(r.actor_id) ?? "?") : undefined,
    }));

  return Response.json({
    posts: withNames(posts.data),
    comments: withNames(comments.data),
    log: withNames(log.data),
  });
}
