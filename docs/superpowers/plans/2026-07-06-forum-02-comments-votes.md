# Community Forum — Plan 02: Threaded Comments + Votes/Karma

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reddit-style up/down voting (posts + comments, atomic karma) and threaded comments (nested replies, collapse, tombstones, depth cap 8) live at `/community`, plus edit/delete of your own posts and comments.

**Architecture:** Per the spec + plan 01: reads client-direct from the `comments_thread` view; writes via `/api/forum/*` using the `cast_vote` / `create_comment` SQL functions that already shipped in migration 0001. The signed-in user's own votes hydrate through a small authenticated GET (votes are RLS-locked). All vote/score mutations stay in Postgres (atomic); the UI is optimistic with server reconciliation.

**Tech Stack:** unchanged (Next 16.2.10 App Router — dynamic route `params` are Promises; Tailwind v4 tokens; supabase-js v2; vitest).

**Spec deltas (agreed):** votes API is one route `GET+POST /api/forum/votes` (instead of `POST /vote`) — one file, same semantics. Own-content edit/delete UI lives on the post detail page (feed cards stay lean in v1). Comment GIFs arrive in plan 04 (`gif_url` stays null here).

**Conventions:** same as plan 01 (alias `@/*`; API routes `runtime="nodejs"` + `force-dynamic`; commit per task; `npx tsc --noEmit` + zero *new* lint problems before each commit — repo baseline is 12 pre-existing errors/8 warnings, none in `forum` files; never pipe-mask exit codes — check them explicitly).

---

### Task 1: Migration 0002 — `author_kick_id` on `comments_thread`

**Files:**
- Create: `supabase/migrations/0002_comments_thread_kick_id.sql`

The client needs to know which comments belong to the signed-in user (edit/delete affordances). `posts_feed` already exposes `author_kick_id`; mirror it on `comments_thread` (masked for removed comments, like the other author fields). `create_comment` returns the view's rowtype, so it must be re-created after the view changes shape.

- [ ] **Step 1: Write the migration file** (content below, verbatim)

```sql
-- 0002: comments_thread gains author_kick_id (client-side ownership UI).
-- create_comment returns this view's rowtype, so re-create it afterwards.

create or replace view public.comments_thread as
  select
    c.id, c.post_id, c.parent_id, c.depth, c.score, c.created_at, c.edited_at,
    (c.removed_at is not null) as removed,
    case when c.removed_at is null then c.body end as body,
    case when c.removed_at is null then c.gif_url end as gif_url,
    case when c.removed_at is null then pr.username end as author_username,
    case when c.removed_at is null then pr.avatar_url end as author_avatar,
    case when c.removed_at is null then pr.role end as author_role,
    case when c.removed_at is null then pr.kick_id end as author_kick_id
  from public.comments c
  join public.profiles pr on pr.id = c.author_id;

grant select on public.comments_thread to anon, authenticated;

create or replace function public.create_comment(
  p_author uuid, p_post uuid, p_parent uuid, p_body text, p_gif_url text
) returns public.comments_thread
language plpgsql security definer set search_path = public
as $$
declare
  v_depth int := 0;
  v_id    uuid;
  v_row   public.comments_thread;
begin
  if (p_body is null or length(trim(p_body)) = 0) and p_gif_url is null then
    raise exception 'empty_comment';
  end if;

  perform 1 from posts where id = p_post and removed_at is null;
  if not found then raise exception 'post_not_found'; end if;

  if p_parent is not null then
    select depth + 1 into v_depth from comments
      where id = p_parent and post_id = p_post;
    if v_depth is null then raise exception 'parent_not_found'; end if;
    if v_depth > 8 then raise exception 'max_depth'; end if;
  end if;

  insert into comments (post_id, parent_id, author_id, body, gif_url, depth)
  values (p_post, p_parent, p_author, nullif(trim(p_body), ''), p_gif_url, v_depth)
  returning id into v_id;

  update posts set comment_count = comment_count + 1 where id = p_post;

  select * into v_row from comments_thread where id = v_id;
  return v_row;
end $$;

revoke execute on function public.create_comment(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
```

- [ ] **Step 2: Apply to the live project** via Supabase MCP `apply_migration` (project `ysaunrhwrzvsrktmoxtg`, name `comments_thread_kick_id`), then verify: `execute_sql` → `select column_name from information_schema.columns where table_name='comments_thread';` includes `author_kick_id`; `select proacl from pg_proc where proname='create_comment';` still excludes anon.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_comments_thread_kick_id.sql
git commit -m "Forum: comments_thread exposes author_kick_id (migration 0002)"
```

---

### Task 2: Client data layer — thread/vote/comment helpers + tree builder (TDD)

**Files:**
- Modify: `src/lib/forum.ts` (append)
- Test: `src/lib/__tests__/forumThread.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/forumThread.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTree, sortTree, type ThreadComment } from "../forum";

const c = (id: string, parent: string | null, over: Partial<ThreadComment> = {}): ThreadComment => ({
  id,
  post_id: "p1",
  parent_id: parent,
  depth: 0,
  score: 0,
  created_at: "2026-07-06T00:00:00.000Z",
  edited_at: null,
  removed: false,
  body: "hi",
  gif_url: null,
  author_username: "andy",
  author_avatar: null,
  author_role: "user",
  author_kick_id: 1,
  ...over,
});

describe("buildTree", () => {
  it("nests children under parents, orphans at root", () => {
    const rows = [c("a", null), c("b", "a"), c("d", "missing"), c("e", "b")];
    const tree = buildTree(rows);
    expect(tree.map((n) => n.comment.id)).toEqual(["a", "d"]);
    expect(tree[0].children[0].comment.id).toBe("b");
    expect(tree[0].children[0].children[0].comment.id).toBe("e");
  });
});

describe("sortTree", () => {
  it("sorts siblings recursively by score (top) or recency (new)", () => {
    const rows = [
      c("a", null, { score: 1, created_at: "2026-07-06T00:00:01.000Z" }),
      c("b", null, { score: 5, created_at: "2026-07-06T00:00:02.000Z" }),
      c("c", null, { score: 3, created_at: "2026-07-06T00:00:03.000Z" }),
      c("d", "b", { score: 0, created_at: "2026-07-06T00:00:04.000Z" }),
      c("e", "b", { score: 9, created_at: "2026-07-06T00:00:05.000Z" }),
    ];
    const top = sortTree(buildTree(rows), "top");
    expect(top.map((n) => n.comment.id)).toEqual(["b", "c", "a"]);
    expect(top[0].children.map((n) => n.comment.id)).toEqual(["e", "d"]);
    const fresh = sortTree(buildTree(rows), "new");
    expect(fresh.map((n) => n.comment.id)).toEqual(["c", "b", "a"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/lib/__tests__/forumThread.test.ts` — exports missing)

- [ ] **Step 3: Append to `src/lib/forum.ts`**

```ts
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
          b.comment.score - a.comment.score || a.comment.created_at.localeCompare(b.comment.created_at)
      : (a: CommentNodeData, b: CommentNodeData) =>
          b.comment.created_at.localeCompare(a.comment.created_at);
  const rec = (list: CommentNodeData[]): CommentNodeData[] =>
    [...list].sort(cmp).map((n) => ({ ...n, children: rec(n.children) }));
  return rec(nodes);
}

async function forumFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
): Promise<ThreadComment> {
  return forumFetch("/api/forum/comments", {
    method: "POST",
    body: JSON.stringify({ post_id: postId, parent_id: parentId, body }),
  });
}

export async function updateComment(id: string, body: string): Promise<ThreadComment> {
  return forumFetch(`/api/forum/comments/${id}`, { method: "PATCH", body: JSON.stringify({ body }) });
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
```

- [ ] **Step 4: Run all tests — PASS** (`npm test`; exit code checked, not piped away)

- [ ] **Step 5: Commit**

```bash
git add src/lib/forum.ts src/lib/__tests__/forumThread.test.ts
git commit -m "Forum: thread/vote/comment client helpers + tree builder"
```

---

### Task 3: `useMe` hook (shared signed-in state)

**Files:**
- Create: `src/components/forum/useMe.ts`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchMe, type Me } from "@/lib/forum";

/* One /api/forum/me round-trip per page load, shared by every forum widget. */

let cached: Promise<Me> | null = null;

export function getMe(): Promise<Me> {
  if (!cached) cached = fetchMe();
  return cached;
}

/** null = still loading */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let stale = false;
    getMe().then((m) => {
      if (!stale) setMe(m);
    });
    return () => {
      stale = true;
    };
  }, []);
  return me;
}
```

- [ ] **Step 2: `npx tsc --noEmit` clean → commit**

```bash
git add src/components/forum/useMe.ts
git commit -m "Forum: useMe hook (shared, cached /me state)"
```

---

### Task 4: Votes API — `GET`/`POST /api/forum/votes`

**Files:**
- Create: `src/app/api/forum/votes/route.ts`

- [ ] **Step 1: Implement**

```ts
import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["post", "comment"]);
const UUID = /^[0-9a-f-]{36}$/i;

/** GET ?type=post&ids=a,b,c → { [subject_id]: -1 | 1 } for the caller. */
export async function GET(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;

  const type = req.nextUrl.searchParams.get("type") ?? "";
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID.test(s))
    .slice(0, 100);
  if (!TYPES.has(type) || !ids.length) return jsonError(400, "bad_request", "type + ids required.");

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data, error } = await admin
    .from("votes")
    .select("subject_id, value")
    .eq("profile_id", caller.profile.id)
    .eq("subject_type", type)
    .in("subject_id", ids);
  if (error) return jsonError(500, "db_error", error.message);

  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.subject_id as string] = row.value as number;
  return Response.json(map);
}

/** POST { subject_type, subject_id, value: -1|0|1 } → { new_score, my_vote } */
export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { subject_type?: unknown; subject_id?: unknown; value?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const type = String(raw.subject_type ?? "");
  const id = String(raw.subject_id ?? "");
  const value = Number(raw.value);
  if (!TYPES.has(type) || !UUID.test(id) || ![-1, 0, 1].includes(value)) {
    return jsonError(400, "bad_request", "Invalid vote.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data, error } = await admin.rpc("cast_vote", {
    p_profile: caller.profile.id,
    p_type: type,
    p_id: id,
    p_value: value,
  });
  if (error) {
    if (error.message.includes("not_found")) return jsonError(404, "not_found", "That no longer exists.");
    return jsonError(500, "db_error", error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return Response.json(row ?? { new_score: 0, my_vote: value });
}
```

- [ ] **Step 2: `npx tsc --noEmit` clean → commit**

```bash
git add src/app/api/forum/votes/route.ts
git commit -m "Forum: votes API (my-votes batch GET + atomic cast POST)"
```

---

### Task 5: Comments API — create, edit, delete

**Files:**
- Create: `src/app/api/forum/comments/route.ts`
- Create: `src/app/api/forum/comments/[id]/route.ts`

- [ ] **Step 1: `comments/route.ts` (POST = create via `create_comment` RPC)**

```ts
import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 5_000;
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { post_id?: unknown; parent_id?: unknown; body?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const postId = String(raw.post_id ?? "");
  const parentId = raw.parent_id == null ? null : String(raw.parent_id);
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!UUID.test(postId) || (parentId !== null && !UUID.test(parentId))) {
    return jsonError(400, "bad_request", "Invalid ids.");
  }
  if (!body || body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Comment must be 1-${MAX_BODY} characters.`);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data, error } = await admin.rpc("create_comment", {
    p_author: caller.profile.id,
    p_post: postId,
    p_parent: parentId,
    p_body: body,
    p_gif_url: null,
  });
  if (error) {
    if (error.message.includes("post_not_found")) return jsonError(404, "not_found", "Post not found.");
    if (error.message.includes("parent_not_found")) return jsonError(400, "bad_parent", "That comment is gone.");
    if (error.message.includes("max_depth")) return jsonError(400, "max_depth", "Thread is too deep — reply higher up.");
    return jsonError(500, "db_error", error.message);
  }
  return Response.json(data);
}
```

- [ ] **Step 2: `comments/[id]/route.ts` (PATCH own edit / DELETE own tombstone)**

```ts
import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 5_000;

async function ownComment(req: NextRequest, id: string) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: comment, error } = await admin
    .from("comments")
    .select("id, author_id, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!comment || comment.removed_at) return jsonError(404, "not_found", "Comment not found.");
  if (comment.author_id !== caller.profile.id) {
    return jsonError(403, "not_yours", "You can only change your own comments.");
  }
  return { caller, admin };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownComment(req, id);
  if (own instanceof Response) return own;
  const bannedRes = bannedResponse(own.caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { body?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!body || body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Comment must be 1-${MAX_BODY} characters.`);
  }

  const { error } = await own.admin
    .from("comments")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);

  const { data: row } = await own.admin.from("comments_thread").select("*").eq("id", id).single();
  return Response.json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownComment(req, id);
  if (own instanceof Response) return own;

  const { error } = await own.admin
    .from("comments")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: own.caller.profile.id,
      removal_reason: "author",
    })
    .eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: `npx tsc --noEmit` clean → commit**

```bash
git add src/app/api/forum/comments/route.ts "src/app/api/forum/comments/[id]/route.ts"
git commit -m "Forum: comments API (create via RPC, edit/delete own)"
```

---

### Task 6: Posts API — edit/delete own

**Files:**
- Create: `src/app/api/forum/posts/[id]/route.ts`

- [ ] **Step 1: Implement** (same ownership pattern; author delete = soft removal `removal_reason='author'`; removed posts vanish from `posts_feed` automatically)

```ts
import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 10_000;

async function ownPost(req: NextRequest, id: string) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: post, error } = await admin
    .from("posts")
    .select("id, author_id, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!post || post.removed_at) return jsonError(404, "not_found", "Post not found.");
  if (post.author_id !== caller.profile.id) {
    return jsonError(403, "not_yours", "You can only change your own posts.");
  }
  return { caller, admin };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownPost(req, id);
  if (own instanceof Response) return own;
  const bannedRes = bannedResponse(own.caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { body?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (body.length > MAX_BODY) return jsonError(400, "bad_body", `Body is limited to ${MAX_BODY} characters.`);

  const { error } = await own.admin
    .from("posts")
    .update({ body: body || null, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownPost(req, id);
  if (own instanceof Response) return own;

  const { error } = await own.admin
    .from("posts")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: own.caller.profile.id,
      removal_reason: "author",
    })
    .eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: `npx tsc --noEmit` clean → commit**

```bash
git add "src/app/api/forum/posts/[id]/route.ts"
git commit -m "Forum: posts API edit/delete own (soft removal)"
```

---

### Task 7: `VoteRail` + feed integration

**Files:**
- Create: `src/components/forum/VoteRail.tsx`
- Modify: `src/components/forum/PostCard.tsx` (replace the static score rail)
- Modify: `src/components/forum/ForumFeed.tsx` (vote state + hydration)

- [ ] **Step 1: `VoteRail`** — parent-controlled (parent owns `{score, myVote}`), optimistic with rollback; signed-out click deep-links/starts login; `compact` renders the horizontal comment variant.

```tsx
"use client";

import { useRef, useState } from "react";
import { appOrigin, castVote, type SubjectType, type VoteValue } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { useMe } from "@/components/forum/useMe";

export type VoteState = { score: number; myVote: VoteValue };

function Arrow({ down = false, active }: { down?: boolean; active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${down ? "rotate-180" : ""} ${
        active ? (down ? "text-blue-400" : "text-accent") : ""
      }`}
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 5l7 8h-4v6h-6v-6H5z" strokeLinejoin="round" />
    </svg>
  );
}

export default function VoteRail({
  type,
  id,
  score,
  myVote,
  onChange,
  compact = false,
}: {
  type: SubjectType;
  id: string;
  score: number;
  myVote: VoteValue;
  onChange: (next: VoteState) => void;
  compact?: boolean;
}) {
  const me = useMe();
  const busy = useRef(false);
  const [flash, setFlash] = useState(false);

  async function vote(dir: 1 | -1) {
    if (me === null) return;
    if ("signedOut" in me) {
      const origin = appOrigin();
      if (origin) window.location.href = `${origin}/community`;
      else if (kickLoginConfigured()) startKickLogin();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const prev: VoteState = { score, myVote };
    const nextVal: VoteValue = myVote === dir ? 0 : dir;
    onChange({ score: score - myVote + nextVal, myVote: nextVal });
    try {
      const res = await castVote(type, id, nextVal);
      onChange({ score: res.new_score, myVote: res.my_vote });
    } catch {
      onChange(prev);
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    } finally {
      busy.current = false;
    }
  }

  const num = (
    <span className={`text-sm font-bold ${flash ? "text-mature" : "text-neutral-200"}`}>{score}</span>
  );
  const btn = "rounded p-0.5 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200";

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1">
        <button type="button" aria-label="Upvote" className={btn} onClick={() => vote(1)}>
          <Arrow active={myVote === 1} />
        </button>
        {num}
        <button type="button" aria-label="Downvote" className={btn} onClick={() => vote(-1)}>
          <Arrow down active={myVote === -1} />
        </button>
      </span>
    );
  }
  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-0.5 pt-1">
      <button type="button" aria-label="Upvote" className={btn} onClick={() => vote(1)}>
        <Arrow active={myVote === 1} />
      </button>
      {num}
      <button type="button" aria-label="Downvote" className={btn} onClick={() => vote(-1)}>
        <Arrow down active={myVote === -1} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `PostCard`** — replace the entire static-rail `<div className="flex w-10 …">…</div>` block with, and add the two props:

```tsx
// signature becomes:
export default function PostCard({
  post,
  full = false,
  myVote = 0,
  onVote,
}: {
  post: FeedPost;
  full?: boolean;
  myVote?: VoteValue;
  onVote?: (next: VoteState) => void;
}) {
```

```tsx
      <VoteRail
        type="post"
        id={post.id}
        score={post.score}
        myVote={myVote}
        onChange={(n) => onVote?.(n)}
      />
```

with imports `import VoteRail, { type VoteState } from "@/components/forum/VoteRail";` and `import { type FeedPost, type VoteValue, timeAgo } from "@/lib/forum";`. The card no longer renders `post.score` itself — the rail does. Parents pass `post={{ ...p, score: currentScore }}`.

- [ ] **Step 3: `ForumFeed`** — add vote state + hydration; render through it:

```tsx
// new imports
import { fetchMyVotes, type VoteValue } from "@/lib/forum";   // merge into existing import
import { getMe } from "@/components/forum/useMe";
import { type VoteState } from "@/components/forum/VoteRail";

// state next to `feed`:
const [voteState, setVoteState] = useState<Record<string, VoteState>>({});

// inside loadMore's try, after setFeed(...) succeeds:
const meRes = await getMe();
if (!("signedOut" in meRes) && page.length) {
  const mine = await fetchMyVotes("post", page.map((p) => p.id));
  setVoteState((prev) => {
    const next = { ...prev };
    for (const p of page) {
      const v = (mine[p.id] ?? 0) as VoteValue;
      if (!next[p.id]) next[p.id] = { score: p.score, myVote: v };
    }
    return next;
  });
}

// render (replaces the plain PostCard map):
{shown.posts?.map((p) => {
  const vs = voteState[p.id];
  return (
    <PostCard
      key={p.id}
      post={vs ? { ...p, score: vs.score } : p}
      myVote={vs?.myVote ?? 0}
      onVote={(next) => setVoteState((prev) => ({ ...prev, [p.id]: next }))}
    />
  );
})}
```

- [ ] **Step 4: Verify in the preview browser** — signed-out: clicking an arrow starts Kick login (localhost) — check no state change; then set a signed-in cookie in the preview console (value from the crafted-cookie script in Task 10) via `document.cookie = "forum_session=<token>"`, reload, vote up on a post → score bumps instantly, arrow goes gold, survives reload (server-persisted).

- [ ] **Step 5: `npx tsc --noEmit` + `npm test` + zero new lint problems → commit**

```bash
git add src/components/forum/VoteRail.tsx src/components/forum/PostCard.tsx src/components/forum/ForumFeed.tsx
git commit -m "Forum: optimistic VoteRail on feed cards"
```

---

### Task 8: Threaded comments UI + post-detail wiring

**Files:**
- Create: `src/components/forum/CommentComposer.tsx`
- Create: `src/components/forum/CommentNode.tsx`
- Create: `src/components/forum/CommentThread.tsx`
- Modify: `src/components/forum/PostView.tsx`

- [ ] **Step 1: `CommentComposer`**

```tsx
"use client";

import { useState } from "react";
import { appOrigin, createComment, type ThreadComment } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { useMe } from "@/components/forum/useMe";

const MAX_BODY = 5_000;

export default function CommentComposer({
  postId,
  parentId = null,
  onDone,
  onCancel,
  autoFocus = false,
}: {
  postId: string;
  parentId?: string | null;
  onDone: (row: ThreadComment) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const me = useMe();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me === null) return null;

  if ("signedOut" in me) {
    const origin = appOrigin();
    return (
      <div className="rounded-lg border border-line bg-panel p-3 text-sm text-neutral-500">
        {origin ? (
          <a href={`${origin}/community/post?id=${postId}`} className="font-semibold text-accent hover:underline">
            Sign in on chickenwebsite.vercel.app to join the conversation
          </a>
        ) : kickLoginConfigured() ? (
          <button type="button" onClick={() => startKickLogin()} className="font-semibold text-accent hover:underline">
            Sign in with Kick to join the conversation
          </button>
        ) : (
          "Kick login isn't configured here."
        )}
      </div>
    );
  }

  if (me.ban) {
    return (
      <p className="rounded-lg border border-mature/40 bg-mature/10 p-3 text-sm text-neutral-400">
        You&apos;re banned from the forum{me.ban.reason ? `: ${me.ban.reason}` : "."}
      </p>
    );
  }

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const row = await createComment(postId, parentId, text);
      setBody("");
      onDone(row);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <textarea
        value={body}
        autoFocus={autoFocus}
        maxLength={MAX_BODY}
        onChange={(e) => setBody(e.target.value)}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? "Reply…" : "What are your thoughts?"}
        className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
      />
      {error && <p className="mt-1 text-sm text-mature">{error}</p>}
      <div className="mt-1.5 flex items-center justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-neutral-400 hover:text-neutral-200">
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={!body.trim() || busy}
          onClick={submit}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Commenting…" : "Comment"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `CommentNode`** — one comment + its children; collapse, reply, edit/delete-own, vote:

```tsx
"use client";

import { useState } from "react";
import {
  timeAgo,
  updateComment,
  deleteComment,
  type CommentNodeData,
  type ThreadComment,
} from "@/lib/forum";
import VoteRail, { type VoteState } from "@/components/forum/VoteRail";
import CommentComposer from "@/components/forum/CommentComposer";

export type ThreadHandlers = {
  postId: string;
  myKickId: number | null;
  voteState: Record<string, VoteState>;
  onVote: (id: string, next: VoteState) => void;
  onReplyDone: (row: ThreadComment) => void;
  onEdited: (row: ThreadComment) => void;
  onDeleted: (id: string) => void;
};

function RoleBadge({ role }: { role: string | null }) {
  if (role !== "moderator" && role !== "admin") return null;
  return (
    <span className={`rounded px-1 py-px text-[10px] font-bold uppercase ${role === "admin" ? "bg-accent/15 text-accent" : "bg-emerald-400/15 text-emerald-300"}`}>
      {role === "admin" ? "Admin" : "Mod"}
    </span>
  );
}

export default function CommentNode({ node, h }: { node: CommentNodeData; h: ThreadHandlers }) {
  const c = node.comment;
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const vs = h.voteState[c.id] ?? { score: c.score, myVote: 0 as const };
  const mine = !c.removed && h.myKickId != null && c.author_kick_id === h.myKickId;

  async function saveEdit() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const row = await updateComment(c.id, text);
      h.onEdited(row);
      setEditing(false);
    } catch {
      /* keep editor open */
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !window.confirm("Delete this comment?")) return;
    setBusy(true);
    try {
      await deleteComment(c.id);
      h.onDeleted(c.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand" : "Collapse"}
          className="mt-0.5 shrink-0"
        >
          {c.author_avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.author_avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-neutral-300">
              {(c.author_username ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-300">
              {c.removed ? "[removed]" : `u/${c.author_username}`}
            </span>
            <RoleBadge role={c.author_role} />
            <span>·</span>
            <span>{timeAgo(c.created_at)} ago</span>
            {c.edited_at && !c.removed && <span className="italic">(edited)</span>}
            {collapsed && <span className="text-neutral-600">[+{node.children.length}]</span>}
          </div>

          {!collapsed && (
            <>
              {editing ? (
                <div className="mt-1.5">
                  <textarea
                    value={draft}
                    maxLength={5000}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent"
                  />
                  <div className="mt-1 flex justify-end gap-3">
                    <button type="button" onClick={() => setEditing(false)} className="text-xs font-semibold text-neutral-400 hover:text-neutral-200">
                      Cancel
                    </button>
                    <button type="button" disabled={!draft.trim() || busy} onClick={saveEdit} className="rounded bg-accent px-3 py-1 text-xs font-bold text-accent-ink disabled:opacity-40">
                      Save
                    </button>
                  </div>
                </div>
              ) : c.removed ? (
                <p className="mt-1 text-sm italic text-neutral-600">[removed]</p>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-200">{c.body}</p>
              )}

              {!c.removed && !editing && (
                <div className="mt-1 flex items-center gap-3 text-xs font-semibold text-neutral-500">
                  <VoteRail compact type="comment" id={c.id} score={vs.score} myVote={vs.myVote} onChange={(n) => h.onVote(c.id, n)} />
                  <button type="button" onClick={() => setReplying(!replying)} className="hover:text-neutral-300">
                    Reply
                  </button>
                  {mine && (
                    <>
                      <button type="button" onClick={() => { setDraft(c.body ?? ""); setEditing(true); }} className="hover:text-neutral-300">
                        Edit
                      </button>
                      <button type="button" onClick={remove} className="hover:text-mature">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}

              {replying && (
                <div className="mt-2">
                  <CommentComposer
                    postId={h.postId}
                    parentId={c.id}
                    autoFocus
                    onCancel={() => setReplying(false)}
                    onDone={(row) => { setReplying(false); h.onReplyDone(row); }}
                  />
                </div>
              )}

              {node.children.length > 0 && (
                <div className="ml-1 border-l border-line pl-3">
                  {node.children.map((child) => (
                    <CommentNode key={child.comment.id} node={child} h={h} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `CommentThread`** — loads rows, hydrates my votes, sort toggle, hands the handler bundle down:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildTree,
  fetchMyVotes,
  fetchThread,
  sortTree,
  type ThreadComment,
  type ThreadSort,
  type VoteValue,
} from "@/lib/forum";
import { getMe, useMe } from "@/components/forum/useMe";
import { type VoteState } from "@/components/forum/VoteRail";
import CommentComposer from "@/components/forum/CommentComposer";
import CommentNode, { type ThreadHandlers } from "@/components/forum/CommentNode";

type ThreadState = { key: string; rows: ThreadComment[] | null; error: string | null };

export default function CommentThread({
  postId,
  onCountChange,
}: {
  postId: string;
  onCountChange?: (delta: number) => void;
}) {
  const me = useMe();
  const [state, setState] = useState<ThreadState>({ key: postId, rows: null, error: null });
  const [sort, setSort] = useState<ThreadSort>("top");
  const [voteState, setVoteState] = useState<Record<string, VoteState>>({});
  const shown: ThreadState = state.key === postId ? state : { key: postId, rows: null, error: null };

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const rows = await fetchThread(postId);
        if (stale) return;
        setState({ key: postId, rows, error: null });
        const meRes = await getMe();
        if (stale || "signedOut" in meRes || !rows.length) return;
        const mine = await fetchMyVotes("comment", rows.map((r) => r.id));
        if (stale) return;
        setVoteState((prev) => {
          const next = { ...prev };
          for (const r of rows) {
            if (!next[r.id]) next[r.id] = { score: r.score, myVote: (mine[r.id] ?? 0) as VoteValue };
          }
          return next;
        });
      } catch (e) {
        if (!stale) setState({ key: postId, rows: null, error: (e as Error).message });
      }
    })();
    return () => {
      stale = true;
    };
  }, [postId]);

  const tree = useMemo(
    () => (shown.rows ? sortTree(buildTree(shown.rows), sort) : []),
    [shown.rows, sort],
  );

  const handlers: ThreadHandlers = {
    postId,
    myKickId: me && !("signedOut" in me) ? me.profile.kickId : null,
    voteState,
    onVote: (id, next) => setVoteState((prev) => ({ ...prev, [id]: next })),
    onReplyDone: (row) => {
      setState((prev) => ({ ...prev, rows: [...(prev.rows ?? []), row] }));
      onCountChange?.(1);
    },
    onEdited: (row) =>
      setState((prev) => ({
        ...prev,
        rows: (prev.rows ?? []).map((r) => (r.id === row.id ? row : r)),
      })),
    onDeleted: (id) =>
      setState((prev) => ({
        ...prev,
        rows: (prev.rows ?? []).map((r) =>
          r.id === id
            ? { ...r, removed: true, body: null, gif_url: null, author_username: null, author_avatar: null, author_role: null, author_kick_id: null }
            : r,
        ),
      })),
  };

  return (
    <div className="mt-4 rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-neutral-200">
          {shown.rows ? `${shown.rows.length} comment${shown.rows.length === 1 ? "" : "s"}` : "Comments"}
        </h3>
        <div className="flex rounded-full border border-line p-0.5 text-xs font-semibold">
          {(["top", "new"] as ThreadSort[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`rounded-full px-2.5 py-0.5 transition-colors ${s === sort ? "bg-accent text-accent-ink" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              {s === "top" ? "Top" : "New"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <CommentComposer postId={postId} onDone={handlers.onReplyDone} />
      </div>

      {shown.rows === null && !shown.error && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      )}
      {shown.error && <p className="mt-4 text-sm text-neutral-500">Couldn&apos;t load comments: {shown.error}</p>}
      {shown.rows !== null && shown.rows.length === 0 && (
        <p className="mt-6 text-center text-sm text-neutral-600">No comments yet — say something!</p>
      )}
      <div>
        {tree.map((node) => (
          <CommentNode key={node.comment.id} node={node} h={handlers} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `PostView`** — vote on the detail card, own-post Edit/Delete, mount the thread (replaces the "Comments are coming" card). Full new content:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deletePost,
  fetchMyVotes,
  fetchPost,
  updatePost,
  type FeedPost,
  type VoteValue,
} from "@/lib/forum";
import { getMe, useMe } from "@/components/forum/useMe";
import { type VoteState } from "@/components/forum/VoteRail";
import PostCard from "@/components/forum/PostCard";
import CommentThread from "@/components/forum/CommentThread";

export default function PostView() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const me = useMe();
  const [result, setResult] = useState<{ id: string; post: FeedPost | null } | null>(null);
  const [vote, setVote] = useState<{ id: string; state: VoteState } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let stale = false;
    (async () => {
      try {
        const p = await fetchPost(id);
        if (stale) return;
        setResult({ id, post: p });
        if (!p) return;
        const meRes = await getMe();
        if (stale || "signedOut" in meRes) return;
        const mine = await fetchMyVotes("post", [id]);
        if (!stale) setVote({ id, state: { score: p.score, myVote: (mine[id] ?? 0) as VoteValue } });
      } catch {
        if (!stale) setResult({ id, post: null });
      }
    })();
    return () => {
      stale = true;
    };
  }, [id]);

  const post: FeedPost | null | "missing" = !id
    ? "missing"
    : result?.id === id
      ? (result.post ?? "missing")
      : null;

  if (post === null) {
    return <div className="h-48 animate-pulse rounded-xl border border-line bg-panel" />;
  }

  if (post === "missing") {
    return (
      <div className="rounded-xl border border-line bg-panel p-10 text-center">
        <p className="font-bold text-neutral-200">This post doesn&apos;t exist (or was removed).</p>
        <Link href="/community" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
          Back to the community feed
        </Link>
      </div>
    );
  }

  const vs = vote?.id === post.id ? vote.state : { score: post.score, myVote: 0 as VoteValue };
  const mine = me != null && !("signedOut" in me) && me.profile.kickId === post.author_kick_id;

  async function saveEdit() {
    if (busy) return;
    setBusy(true);
    try {
      await updatePost(post.id, draft.trim());
      setResult((prev) =>
        prev?.post
          ? { ...prev, post: { ...prev.post, body: draft.trim() || null, edited_at: new Date().toISOString() } }
          : prev,
      );
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function removePost() {
    if (busy || !window.confirm("Delete this post?")) return;
    setBusy(true);
    try {
      await deletePost(post.id);
      router.push("/community");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PostCard
        post={{ ...post, score: vs.score }}
        full
        myVote={vs.myVote}
        onVote={(next) => setVote({ id: post.id, state: next })}
      />

      {mine && (
        <div className="mt-2 flex justify-end gap-3 text-xs font-semibold text-neutral-500">
          {editing ? null : (
            <>
              <button type="button" onClick={() => { setDraft(post.body ?? ""); setEditing(true); }} className="hover:text-neutral-300">
                Edit post
              </button>
              <button type="button" onClick={removePost} className="hover:text-mature">
                Delete post
              </button>
            </>
          )}
        </div>
      )}

      {editing && (
        <div className="mt-2 rounded-xl border border-line bg-panel p-3">
          <textarea
            value={draft}
            maxLength={10000}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent"
          />
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(false)} className="text-xs font-semibold text-neutral-400 hover:text-neutral-200">
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={saveEdit} className="rounded bg-accent px-3 py-1 text-xs font-bold text-accent-ink disabled:opacity-40">
              Save
            </button>
          </div>
        </div>
      )}

      <CommentThread
        postId={post.id}
        onCountChange={(d) =>
          setResult((prev) =>
            prev?.post ? { ...prev, post: { ...prev.post, comment_count: prev.post.comment_count + d } } : prev,
          )
        }
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify in the preview browser** (signed-in via crafted cookie): top-level comment appears instantly; reply nests with a thread line; collapse toggles; Top/New resorts; edit shows "(edited)"; delete leaves a "[removed]" tombstone; comment count on the card bumps; votes on comments persist across reload.

- [ ] **Step 6: `npx tsc --noEmit` + `npm test` + zero new lint problems → commit**

```bash
git add src/components/forum/CommentComposer.tsx src/components/forum/CommentNode.tsx src/components/forum/CommentThread.tsx src/components/forum/PostView.tsx
git commit -m "Forum: threaded comments (reply/collapse/edit/delete, sort) + own-post controls"
```

---

### Task 9: Full verification + deploy + prod smoke

- [ ] **Step 1:** `npm test`, `npx tsc --noEmit`, lint (baseline only), `npm run build` — all green, exit codes checked.
- [ ] **Step 2: Local API E2E** with a crafted `forum_session` cookie (same script as plan 01's Task-13 probe): create post → comment → nested reply (depth 1) → vote post +1 → vote comment −1 → retract → verify via `comments_thread`/`posts_feed` reads; then clean up rows via Supabase MCP (`delete from posts where id=…` cascades attachments; delete votes + comments rows for it).
- [ ] **Step 3:** Push `main` (Vercel + Pages auto-deploy); watch the Pages run; poll prod.
- [ ] **Step 4: Prod smoke** — crafted cookie against `https://chickenwebsite.vercel.app`: create a throwaway post, comment, vote, verify JSON, then remove all trace rows via Supabase MCP SQL (posts cascade + votes cleanup). The user's real welcome post is never touched.
- [ ] **Step 5:** Browser check of the live post page in Chrome (comment box renders; vote arrows live).

## Self-review notes

- **Spec coverage (phase 3):** votes ±1 both subjects + atomic karma (Task 4 via `cast_vote`), threaded comments depth-capped with tombstones (Tasks 1, 5, 8), `get_thread`-equivalent view read (Task 2), optimistic vote UI + login prompt (Task 7), comment sort Top/New (Task 8), own edit/delete for posts+comments (§6 rows, Tasks 5, 6, 8). GIFs deliberately plan 04; mod removal powers plan 05.
- **Type consistency:** `ThreadComment` mirrors `comments_thread` columns incl. new `author_kick_id` (Task 1); `VoteState`/`VoteValue` shared via `VoteRail`/`forum.ts`; `create_comment` returns the view row that `createComment()` types as `ThreadComment`; route param signatures use the Next-16 `Promise<{id}>` convention.
- **No placeholders:** every step has complete code; the two deferred seams (GIF button, mod tools) are explicitly assigned to plans 04/05.

