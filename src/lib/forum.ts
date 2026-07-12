import { getSupabase } from "@/lib/supabase";

/* Client-side forum data layer. Reads go straight to Supabase with the anon
   key (RLS-locked views + get_feed RPC) — same everywhere incl. the static
   Pages mirror. Writes are fetch() calls to /api/forum/* (Vercel only). */

export type FeedAttachment = {
  kind: "image" | "video" | "kick_clip" | "twitch_clip";
  url: string | null;
  storage_path: string | null;
  embed_id: string | null;
  width: number | null;
  height: number | null;
  position: number;
};

export type FeedPost = {
  id: string;
  title: string;
  body: string | null;
  kind: "text" | "image" | "video" | "embed";
  score: number;
  comment_count: number;
  created_at: string;
  edited_at: string | null;
  flair_id: number;
  flair_name: string;
  flair_color: string;
  author_username: string;
  author_avatar: string | null;
  author_role: "user" | "moderator" | "admin";
  author_kick_id: number;
  hot_score: number;
  attachments: FeedAttachment[];
};

export type Flair = { id: number; name: string; color: string; position: number };
export type FeedSort = "hot" | "new" | "top";
export type FeedCursor = { k: string | number; id: string } | null;

export const FEED_PAGE = 20;

export function nextCursor(sort: FeedSort, page: FeedPost[]): FeedCursor {
  const last = page[page.length - 1];
  if (!last) return null;
  if (sort === "new") return { k: last.created_at, id: last.id };
  if (sort === "top") return { k: last.score, id: last.id };
  return { k: last.hot_score, id: last.id };
}

export async function fetchFeed(
  sort: FeedSort,
  flair: number | null,
  cursor: FeedCursor,
): Promise<FeedPost[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("get_feed", {
    p_sort: sort,
    p_flair: flair,
    p_cursor: cursor,
    p_limit: FEED_PAGE,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedPost[];
}

export const SEARCH_PAGE = 25;
export const SEARCH_MAX = 200; // matches the RPC's offset clamp

/** Ranked full-text post search (plan 06). Offset paging, capped at SEARCH_MAX. */
export async function fetchSearch(
  q: string,
  flair: number | null,
  offset: number,
): Promise<FeedPost[]> {
  const sb = getSupabase();
  if (!sb || !q.trim()) return [];
  const { data, error } = await sb.rpc("search_posts", {
    p_q: q.trim(),
    p_flair: flair,
    p_limit: SEARCH_PAGE,
    p_offset: Math.min(Math.max(offset, 0), SEARCH_MAX),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedPost[];
}

export async function fetchFlairs(): Promise<Flair[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("flairs")
    .select("id, name, color, position")
    .order("position")
    .order("id");
  if (error) throw new Error(error.message);
  return (data ?? []) as Flair[];
}

export async function fetchPost(id: string): Promise<FeedPost | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("posts_feed").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FeedPost) ?? null;
}

/** Compact reddit-style age: 30s, 45m, 9h, 4d, 2mo, 2y. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(1, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

/** Vercel origin for write deep-links on the static Pages mirror ("" locally/on Vercel). */
export function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_ORIGIN || "";
}

export type MeProfile = {
  id: string;
  kickId: number;
  username: string;
  avatarUrl: string | null;
  role: "user" | "moderator" | "admin";
  postKarma: number;
  commentKarma: number;
  createdAt: string;
};
export type Me =
  | { signedOut: true }
  | { profile: MeProfile; ban: { reason: string | null; expires_at: string | null } | null };

export async function fetchMe(): Promise<Me> {
  try {
    const r = await fetch("/api/forum/me", { cache: "no-store" });
    if (!r.ok) return { signedOut: true };
    return (await r.json()) as Me;
  } catch {
    // Pages mirror has no API routes → read-only, treat as signed out
    return { signedOut: true };
  }
}

/* ------------------------------------------------------------------ */
/* Comments + votes (plan 02)                                          */

export type ThreadComment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  depth: number;
  score: number;
  created_at: string;
  edited_at: string | null;
  removed: boolean;
  body: string | null;
  gif_url: string | null;
  author_username: string | null;
  author_avatar: string | null;
  author_role: "user" | "moderator" | "admin" | null;
  author_kick_id: number | null;
};

export type CommentNodeData = { comment: ThreadComment; children: CommentNodeData[] };
export type ThreadSort = "top" | "new";
export type VoteValue = -1 | 0 | 1;
export type SubjectType = "post" | "comment";

export async function fetchThread(postId: string): Promise<ThreadComment[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("comments_thread")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ThreadComment[];
}

/** Flat rows → forest. Children of removed/unknown parents fall back to root. */
export function buildTree(rows: ThreadComment[]): CommentNodeData[] {
  const nodes = new Map<string, CommentNodeData>();
  for (const row of rows) nodes.set(row.id, { comment: row, children: [] });
  const roots: CommentNodeData[] = [];
  for (const node of nodes.values()) {
    const parent = node.comment.parent_id ? nodes.get(node.comment.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function sortTree(nodes: CommentNodeData[], sort: ThreadSort): CommentNodeData[] {
  const cmp =
    sort === "top"
      ? (a: CommentNodeData, b: CommentNodeData) =>
          b.comment.score - a.comment.score ||
          a.comment.created_at.localeCompare(b.comment.created_at)
      : (a: CommentNodeData, b: CommentNodeData) =>
          b.comment.created_at.localeCompare(a.comment.created_at);
  const rec = (list: CommentNodeData[]): CommentNodeData[] =>
    [...list].sort(cmp).map((n) => ({ ...n, children: rec(n.children) }));
  return rec(nodes);
}

export async function forumFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || `Request failed (${r.status}).`);
  return j as T;
}

/** The signed-in user's votes for a set of subjects ({} when signed out / on the mirror). */
export async function fetchMyVotes(
  type: SubjectType,
  ids: string[],
): Promise<Record<string, VoteValue>> {
  if (!ids.length) return {};
  try {
    return await forumFetch(`/api/forum/votes?type=${type}&ids=${ids.join(",")}`);
  } catch {
    return {};
  }
}

export async function castVote(
  type: SubjectType,
  id: string,
  value: VoteValue,
): Promise<{ new_score: number; my_vote: VoteValue }> {
  return forumFetch("/api/forum/votes", {
    method: "POST",
    body: JSON.stringify({ subject_type: type, subject_id: id, value }),
  });
}

export async function createComment(
  postId: string,
  parentId: string | null,
  body: string,
  gifUrl: string | null = null,
): Promise<ThreadComment> {
  return forumFetch("/api/forum/comments", {
    method: "POST",
    body: JSON.stringify({ post_id: postId, parent_id: parentId, body, gif_url: gifUrl }),
  });
}

export type GifResult = {
  id: string;
  preview: string;
  url: string;
  width: number;
  height: number;
  alt: string;
};

export async function searchGifs(q: string): Promise<GifResult[]> {
  const j = await forumFetch<{ results: GifResult[] }>(
    `/api/forum/gif-search?q=${encodeURIComponent(q)}`,
  );
  return j.results;
}

export async function updateComment(id: string, body: string): Promise<ThreadComment> {
  return forumFetch(`/api/forum/comments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export async function deleteComment(id: string): Promise<void> {
  await forumFetch(`/api/forum/comments/${id}`, { method: "DELETE" });
}

export async function updatePost(id: string, body: string): Promise<void> {
  await forumFetch(`/api/forum/posts/${id}`, { method: "PATCH", body: JSON.stringify({ body }) });
}

export async function deletePost(id: string): Promise<void> {
  await forumFetch(`/api/forum/posts/${id}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Moderation (plan 05)                                                */

export async function modRemove(type: SubjectType, id: string, reason: string): Promise<void> {
  await forumFetch(`/api/forum/${type === "post" ? "posts" : "comments"}/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
}

export async function banUser(kickId: number, reason: string, days: number | null): Promise<void> {
  await forumFetch("/api/forum/mod/bans", {
    method: "POST",
    body: JSON.stringify({ kick_id: kickId, reason, days }),
  });
}

/* ------------------------------------------------------------------ */
/* Reports (plan 06)                                                   */

export type ReportReason = "spam" | "harassment" | "nsfw" | "misinfo" | "other";

export async function reportContent(
  type: SubjectType,
  id: string,
  reason: ReportReason,
  detail: string,
): Promise<{ ok?: boolean; already?: boolean }> {
  return forumFetch("/api/forum/reports", {
    method: "POST",
    body: JSON.stringify({
      subject_type: type,
      subject_id: id,
      reason,
      detail: detail || undefined,
    }),
  });
}

export type ModReportGroup = {
  subject_type: SubjectType;
  subject_id: string;
  count: number;
  reasons: Record<string, number>;
  reporters: string[];
  details: string[];
  first_at: string;
  last_at: string;
  preview:
    | { title: string; author_username: string; removed: boolean }
    | { body: string; post_id: string; author_username: string; removed: boolean }
    | null;
};

export async function fetchModReports(): Promise<ModReportGroup[]> {
  const j = await forumFetch<{ reports: ModReportGroup[] }>("/api/forum/mod/reports");
  return j.reports;
}

export async function dismissReports(type: SubjectType, id: string): Promise<void> {
  await forumFetch("/api/forum/mod/reports", {
    method: "POST",
    body: JSON.stringify({ subject_type: type, subject_id: id, action: "dismiss" }),
  });
}

/** Admin-only: permanently delete a removed leaf comment (clear its tombstone). */
export async function purgeComment(id: string): Promise<void> {
  await forumFetch("/api/forum/mod/purge", {
    method: "POST",
    body: JSON.stringify({ comment_id: id }),
  });
}
