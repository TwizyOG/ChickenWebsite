import { type NextRequest } from "next/server";
import { jsonError, logMod, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

type ReportRow = {
  subject_type: "post" | "comment";
  subject_id: string;
  reason: string;
  detail: string | null;
  created_at: string;
  reporter_id: string;
};

type Group = {
  subject_type: "post" | "comment";
  subject_id: string;
  count: number;
  reasons: Record<string, number>;
  reporter_ids: Set<string>;
  details: string[];
  first_at: string;
  last_at: string;
};

/** GET → { reports: [...] } — open reports grouped by subject, newest first. Mod+. */
export async function GET(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data, error } = await admin
    .from("reports")
    .select("subject_type, subject_id, reason, detail, created_at, reporter_id")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return jsonError(500, "db_error", error.message);
  const rows = (data ?? []) as ReportRow[];

  const groups = new Map<string, Group>();
  for (const r of rows) {
    const k = `${r.subject_type}:${r.subject_id}`;
    let g = groups.get(k);
    if (!g) {
      g = {
        subject_type: r.subject_type,
        subject_id: r.subject_id,
        count: 0,
        reasons: {},
        reporter_ids: new Set(),
        details: [],
        first_at: r.created_at,
        last_at: r.created_at,
      };
      groups.set(k, g);
    }
    g.count += 1;
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    g.reporter_ids.add(r.reporter_id);
    if (r.detail) g.details.push(r.detail);
    if (r.created_at < g.first_at) g.first_at = r.created_at;
    if (r.created_at > g.last_at) g.last_at = r.created_at;
  }

  const postIds = [...groups.values()].filter((g) => g.subject_type === "post").map((g) => g.subject_id);
  const commentIds = [...groups.values()].filter((g) => g.subject_type === "comment").map((g) => g.subject_id);
  const authorIds = new Set<string>();

  const postMap = new Map<string, { title: string; author_id: string; removed: boolean }>();
  if (postIds.length) {
    const { data: posts } = await admin
      .from("posts")
      .select("id, title, author_id, removed_at")
      .in("id", postIds);
    for (const p of posts ?? []) {
      postMap.set(p.id as string, {
        title: p.title as string,
        author_id: p.author_id as string,
        removed: p.removed_at != null,
      });
      authorIds.add(p.author_id as string);
    }
  }
  const commentMap = new Map<
    string,
    { body: string | null; post_id: string; author_id: string; removed: boolean }
  >();
  if (commentIds.length) {
    const { data: comments } = await admin
      .from("comments")
      .select("id, body, post_id, author_id, removed_at")
      .in("id", commentIds);
    for (const c of comments ?? []) {
      commentMap.set(c.id as string, {
        body: (c.body as string | null) ?? null,
        post_id: c.post_id as string,
        author_id: c.author_id as string,
        removed: c.removed_at != null,
      });
      authorIds.add(c.author_id as string);
    }
  }

  const allReporterIds = new Set<string>();
  for (const g of groups.values()) for (const rid of g.reporter_ids) allReporterIds.add(rid);
  const nameIds = [...new Set([...authorIds, ...allReporterIds])];
  const names = new Map<string, string>();
  if (nameIds.length) {
    const { data: profs } = await admin.from("profiles").select("id, username").in("id", nameIds);
    for (const p of profs ?? []) names.set(p.id as string, p.username as string);
  }

  const reports = [...groups.values()]
    .sort((a, b) => b.last_at.localeCompare(a.last_at))
    .slice(0, 50)
    .map((g) => {
      const post = g.subject_type === "post" ? postMap.get(g.subject_id) : undefined;
      const comment = g.subject_type === "comment" ? commentMap.get(g.subject_id) : undefined;
      const authorId = post?.author_id ?? comment?.author_id;
      return {
        subject_type: g.subject_type,
        subject_id: g.subject_id,
        count: g.count,
        reasons: g.reasons,
        reporters: [...g.reporter_ids].slice(0, 5).map((rid) => names.get(rid) ?? "?"),
        details: g.details.slice(0, 5),
        first_at: g.first_at,
        last_at: g.last_at,
        preview: post
          ? {
              title: post.title,
              author_username: names.get(post.author_id) ?? "?",
              removed: post.removed,
            }
          : comment
            ? {
                body: comment.body ?? "(gif)",
                post_id: comment.post_id,
                author_username: authorId ? (names.get(authorId) ?? "?") : "?",
                removed: comment.removed,
              }
            : null,
      };
    });

  return Response.json({ reports });
}

/** POST { subject_type, subject_id, action: "dismiss" } → resolves all open reports. Mod+. */
export async function POST(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  let raw: { subject_type?: unknown; subject_id?: unknown; action?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const type = String(raw.subject_type ?? "");
  const id = String(raw.subject_id ?? "");
  if (!["post", "comment"].includes(type) || !UUID.test(id) || raw.action !== "dismiss") {
    return jsonError(400, "bad_request", "Invalid dismiss.");
  }

  const { error } = await admin
    .from("reports")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: caller.profile.id,
      resolution: "dismissed",
    })
    .eq("subject_type", type)
    .eq("subject_id", id)
    .is("resolved_at", null);
  if (error) return jsonError(500, "db_error", error.message);

  await logMod(caller.profile.id, "report_dismiss", type, id, {});
  return Response.json({ ok: true });
}
