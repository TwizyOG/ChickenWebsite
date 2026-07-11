import { type NextRequest } from "next/server";
import { jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIST_MAX = 50;

/* Per-user notification feed for the header bell. No ban gate on purpose:
   banned users may read notifications — that's how they learn what happened. */

type Row = {
  id: number;
  kind: string;
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  detail: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

/** GET ?limit=&before=&count_only=1 → { notifications, unread }. */
export async function GET(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { count, error: countError } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", caller.profile.id)
    .is("read_at", null);
  if (countError) return jsonError(500, "db_error", countError.message);
  const unread = count ?? 0;

  if (req.nextUrl.searchParams.get("count_only")) return Response.json({ unread });

  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, LIST_MAX) : 30;
  const before = Number(req.nextUrl.searchParams.get("before"));

  let query = admin
    .from("notifications")
    .select("id, kind, actor_id, post_id, comment_id, detail, read_at, created_at")
    .eq("profile_id", caller.profile.id)
    .order("id", { ascending: false })
    .limit(limit);
  if (Number.isInteger(before) && before > 0) query = query.lt("id", before);
  const { data, error } = await query;
  if (error) return jsonError(500, "db_error", error.message);
  const rows = (data ?? []) as Row[];

  // Join actor names for replies only; mod removals stay anonymous.
  const actorIds = [
    ...new Set(
      rows
        .filter((r) => r.kind === "reply_post" || r.kind === "reply_comment")
        .map((r) => r.actor_id)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const actors = new Map<string, { username: string; avatar_url: string | null }>();
  if (actorIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", actorIds);
    for (const p of profs ?? []) {
      actors.set(p.id as string, {
        username: p.username as string,
        avatar_url: (p.avatar_url as string | null) ?? null,
      });
    }
  }

  const notifications = rows.map((r) => {
    const isReply = r.kind === "reply_post" || r.kind === "reply_comment";
    const actor = isReply && r.actor_id ? actors.get(r.actor_id) : undefined;
    return {
      id: r.id,
      kind: r.kind,
      post_id: r.post_id,
      comment_id: r.comment_id,
      detail: r.detail,
      read_at: r.read_at,
      created_at: r.created_at,
      actor_username: actor?.username ?? null,
      actor_avatar: actor?.avatar_url ?? null,
    };
  });

  return Response.json({ notifications, unread });
}

/** POST {all:true} | {ids:number[]} → marks read → { unread }. */
export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  let raw: { all?: unknown; ids?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const ids = Array.isArray(raw.ids)
    ? raw.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100)
    : [];
  if (raw.all !== true && !ids.length) {
    return jsonError(400, "bad_request", "Pass all:true or ids[].");
  }

  let update = admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", caller.profile.id)
    .is("read_at", null);
  if (raw.all !== true) update = update.in("id", ids);
  const { error } = await update;
  if (error) return jsonError(500, "db_error", error.message);

  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", caller.profile.id)
    .is("read_at", null);
  return Response.json({ unread: count ?? 0 });
}
