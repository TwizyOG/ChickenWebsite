# Forum Plan 06 — Engagement & Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reply/mod notifications in the site header bell, realtime thread/feed/bell updates via broadcast pings, Postgres full-text post search, and a user report queue for mods — per the approved spec `docs/superpowers/specs/2026-07-11-forum-06-engagement-design.md`.

**Architecture:** One idempotent migration (`0003_forum_v2.sql`) adds `notifications` + `reports` (RLS deny-all, service-role only), a weighted `search_tsv` + `search_posts` RPC, and a same-signature `create_comment` v2 that inserts reply notifications transactionally. Private reads (notifications) go through authed `/api/forum/*` routes; realtime is content-free broadcast pings on public channels (`post:{id}`, `feed`, `user:{kick_id}`) fired best-effort from write routes, with clients refetching through the existing masked views/RPCs.

**Tech Stack:** Next.js 16.2.10 App Router, React 19, Tailwind v4, `@supabase/supabase-js` 2.110 (anon reads + Realtime websocket), Supabase Postgres/Realtime, vitest.

---

## Context for the executor (read first)

- **Read `node_modules/next/dist/docs/` guidance if touching Next APIs you're unsure of** (AGENTS.md rule; this plan sticks to already-used APIs).
- **Gates per task:** `npm run lint` (repo has ~12 pre-existing errors in NON-forum files — the gate is *zero errors in files this plan touches*), `npm run build`, `npx vitest run` (all green). Run all three before every commit.
- **Supabase project:** `ysaunrhwrzvsrktmoxtg` (Supabase MCP tools available). Apply the migration with `mcp__supabase__apply_migration`; fallback is the user pasting the SQL into the dashboard SQL editor.
- **Local env:** `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FORUM_SESSION_SECRET` for dev-server E2E (they were present for plans 02–05; `npx vercel env pull` if missing).
- **Broadcast REST endpoint (verified in Supabase docs):** `POST {SUPABASE_URL}/realtime/v1/api/broadcast` with `apikey` header, body `{"messages":[{"topic":"…","event":"…","payload":{…}}]}`. Clients subscribe with `supabase.channel(topic).on("broadcast", { event }, cb).subscribe()` — public channels, no auth config needed.
- **Testing gotchas (from plans 02–05):** crafted `forum_session` cookies expire — mint fresh each session; dev-server first-hit route compilation makes short waits sample in-flight (confirm against DB); background browser tabs throttle IntersectionObserver/websockets — front a tab (screenshot) before checking live updates; if the preview pane viewport wedges to 0x0, fall back to claude-in-chrome on localhost.
- **Commit style:** one commit per task, message given in the task. End every commit message with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

### File map

| File | Task | Change |
|---|---|---|
| `supabase/migrations/0003_forum_v2.sql` | 1 | Create — all DDL + `create_comment` v2 + `search_posts` |
| `src/lib/forumApi.ts` | 2 | Add `notify()` helper |
| `src/app/api/forum/notifications/route.ts` | 2 | Create — GET list/count, POST mark-read |
| `src/app/api/forum/posts/[id]/route.ts` | 2, 5, 6 | Mod-removal notification; `removed` + `notif` pings; report auto-resolve |
| `src/app/api/forum/comments/[id]/route.ts` | 2, 5, 6 | Same as above for comments |
| `src/lib/forumNotifications.ts` | 3 | Create — client fetch/mark-read + bell mappers (pure, tested) |
| `src/lib/__tests__/forumNotifications.test.ts` | 3 | Create — TDD for mappers/merge |
| `src/components/Header.tsx` | 3, 5 | Bell merge + mark-read; live `user:{kickId}` subscription |
| `src/components/forum/CommentNode.tsx` | 3, 6 | `id="c-{id}"` anchor; Report action |
| `src/components/forum/CommentThread.tsx` | 3, 5 | Hash-scroll on load; `refreshKey` prop |
| `src/lib/forum.ts` | 4, 6 | `fetchSearch` + consts; report/mod-report client fns |
| `src/components/forum/ForumFeed.tsx` | 4, 5 | Search mode + SearchInput; live "new posts" pill |
| `src/lib/forumRealtime.ts` | 5 | Create — server `broadcastPing` |
| `src/lib/forumLive.ts` | 5 | Create — client `useLiveChannel` hook |
| `src/app/api/forum/comments/route.ts` | 5 | `comments` ping + notification fan-out pings |
| `src/app/api/forum/votes/route.ts` | 5 | `votes` ping |
| `src/app/api/forum/posts/route.ts` | 5 | `feed` ping |
| `src/components/forum/PostView.tsx` | 5 | Live post/thread refetch |
| `src/app/api/forum/reports/route.ts` | 6 | Create — POST report |
| `src/app/api/forum/mod/reports/route.ts` | 6 | Create — GET grouped queue, POST dismiss |
| `src/components/forum/ReportDialog.tsx` | 6 | Create — report modal |
| `src/components/forum/PostCard.tsx` | 6 | Report action |
| `src/components/forum/ModTools.tsx` | 6 | Reports tab |

---

### Task 1: Migration `0003_forum_v2.sql` (notifications, reports, search, `create_comment` v2)

**Files:**
- Create: `supabase/migrations/0003_forum_v2.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Forum v2 (plan 06): notifications, reports, post search, create_comment v2.
-- Idempotent; safe to re-run. Posture unchanged: RLS deny-all on new tables
-- (service-role only); public reads stay on postgres-owned views/RPCs.

-- ------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id         bigserial primary key,
  profile_id uuid not null references public.profiles(id),
  kind       text not null check (kind in
               ('reply_post','reply_comment','mod_remove_post','mod_remove_comment')),
  actor_id   uuid references public.profiles(id),
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  detail     jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx
  on public.notifications (profile_id, id desc);
create index if not exists notifications_unread_idx
  on public.notifications (profile_id) where read_at is null;
alter table public.notifications enable row level security;
-- no policies: anon/authenticated denied; reads go through the authed API route.

-- ------------------------------------------------------------------ reports
create table if not exists public.reports (
  id           bigserial primary key,
  reporter_id  uuid not null references public.profiles(id),
  subject_type text not null check (subject_type in ('post','comment')),
  subject_id   uuid not null,
  reason       text not null check (reason in ('spam','harassment','nsfw','misinfo','other')),
  detail       text check (char_length(detail) <= 500),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id),
  resolution   text check (resolution in ('dismissed','removed'))
);
create unique index if not exists reports_open_dedupe_idx
  on public.reports (reporter_id, subject_type, subject_id) where resolved_at is null;
create index if not exists reports_open_idx
  on public.reports (created_at desc) where resolved_at is null;
alter table public.reports enable row level security;

-- ------------------------------------------------------------------- search
alter table public.posts add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored;
create index if not exists posts_search_idx on public.posts using gin (search_tsv);

-- Ranked search over the masked feed view (same postgres-owned read-surface
-- posture as the views themselves; removed posts are excluded by the join).
create or replace function public.search_posts(
  p_q      text,
  p_flair  int default null,
  p_limit  int default 25,
  p_offset int default 0
) returns setof public.posts_feed
language sql stable security definer set search_path = public
as $$
  select pf.*
  from public.posts_feed pf
  join public.posts p on p.id = pf.id
  where websearch_to_tsquery('english', coalesce(p_q, '')) @@ p.search_tsv
    and (p_flair is null or pf.flair_id = p_flair)
  order by ts_rank(p.search_tsv, websearch_to_tsquery('english', coalesce(p_q, ''))) desc,
           pf.created_at desc, pf.id desc
  limit least(greatest(p_limit, 1), 50)
  offset least(greatest(p_offset, 0), 200)
$$;

grant execute on function public.search_posts(text, int, int, int) to anon, authenticated;

-- --------------------------------------------- create_comment v2 (+ notify)
-- Same signature as 0001 (routes unchanged). Adds transactional reply
-- notifications: top-level -> post author, nested -> parent comment author,
-- never the commenter themselves.
create or replace function public.create_comment(
  p_author uuid, p_post uuid, p_parent uuid, p_body text, p_gif_url text
) returns public.comments_thread
language plpgsql security definer set search_path = public
as $$
declare
  v_depth         int := 0;
  v_id            uuid;
  v_row           public.comments_thread;
  v_post_author   uuid;
  v_post_title    text;
  v_parent_author uuid;
  v_excerpt       text;
begin
  if (p_body is null or length(trim(p_body)) = 0) and p_gif_url is null then
    raise exception 'empty_comment';
  end if;

  select author_id, title into v_post_author, v_post_title
    from posts where id = p_post and removed_at is null;
  if not found then raise exception 'post_not_found'; end if;

  if p_parent is not null then
    select depth + 1, author_id into v_depth, v_parent_author from comments
      where id = p_parent and post_id = p_post;
    if v_depth is null then raise exception 'parent_not_found'; end if;
    if v_depth > 8 then raise exception 'max_depth'; end if;
  end if;

  insert into comments (post_id, parent_id, author_id, body, gif_url, depth)
  values (p_post, p_parent, p_author, nullif(trim(p_body), ''), p_gif_url, v_depth)
  returning id into v_id;

  update posts set comment_count = comment_count + 1 where id = p_post;

  v_excerpt := coalesce(left(nullif(trim(p_body), ''), 140), '[gif]');

  if p_parent is null then
    if v_post_author <> p_author then
      insert into notifications (profile_id, kind, actor_id, post_id, comment_id, detail)
      values (v_post_author, 'reply_post', p_author, p_post, v_id,
              jsonb_build_object('post_title', v_post_title, 'excerpt', v_excerpt));
    end if;
  else
    if v_parent_author is not null and v_parent_author <> p_author then
      insert into notifications (profile_id, kind, actor_id, post_id, comment_id, detail)
      values (v_parent_author, 'reply_comment', p_author, p_post, v_id,
              jsonb_build_object('post_title', v_post_title, 'excerpt', v_excerpt));
    end if;
  end if;

  select * into v_row from comments_thread where id = v_id;
  return v_row;
end $$;

revoke execute on function public.create_comment(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
```

- [ ] **Step 2: Apply to the live project**

Use `mcp__supabase__apply_migration` (project `ysaunrhwrzvsrktmoxtg`, name `0003_forum_v2`) with the file's SQL. If MCP write access is denied, hand the SQL to the user for the dashboard SQL editor and wait.

- [ ] **Step 3: Smoke-verify via `mcp__supabase__execute_sql`**

```sql
-- a) objects exist
select to_regclass('public.notifications') as n, to_regclass('public.reports') as r;
-- expect both non-null

-- b) anon is locked out (run as raw SQL — checks policies/grants indirectly)
select count(*) from pg_policies where tablename in ('notifications','reports');
-- expect 0 (deny-all: RLS on, no policies)

-- c) search matches and masks
select id, title from public.search_posts('welcome', null, 5, 0);
-- expect the "Welcome to the ChickenAndy Community" post

-- d) reply notification fires exactly once, not on self-reply
--    (use two real profile ids: select id from profiles limit 2)
-- run create_comment as a top-level comment by profile B on a post by profile A,
-- then: select kind, profile_id, detail from notifications order by id desc limit 1;
-- expect kind reply_post, profile_id = A, detail has post_title + excerpt.
-- Clean up: delete the test comment + notification rows, and
-- update posts set comment_count = comment_count - 1 where id = <post>.
```

- [ ] **Step 4: Gates + commit**

```bash
npm run lint && npm run build && npx vitest run
git add supabase/migrations/0003_forum_v2.sql
git commit -m "Forum: migration 0003 (notifications, reports, search, create_comment v2)"
```

---

### Task 2: Notifications backend (API route + mod-removal inserts)

**Files:**
- Modify: `src/lib/forumApi.ts` (append `notify` helper after `logMod`)
- Create: `src/app/api/forum/notifications/route.ts`
- Modify: `src/app/api/forum/posts/[id]/route.ts`
- Modify: `src/app/api/forum/comments/[id]/route.ts`

- [ ] **Step 1: Add `notify()` to `src/lib/forumApi.ts`** (below `logMod`, same best-effort pattern)

```ts
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
```

- [ ] **Step 2: Create `src/app/api/forum/notifications/route.ts`**

```ts
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
```

- [ ] **Step 3: Mod-removal notification in `src/app/api/forum/posts/[id]/route.ts`**

Add `notify` to the existing import from `@/lib/forumApi`, then extend the `if (!own)` block in `DELETE` (after `logMod`):

```ts
  if (!own) {
    await logMod(caller.profile.id, "remove_post", "post", id, { title: post.title, reason });
    await notify(post.author_id as string, "mod_remove_post", caller.profile.id, id, null, {
      post_title: post.title,
      reason,
    });
  }
```

- [ ] **Step 4: Same for comments in `src/app/api/forum/comments/[id]/route.ts`**

Change the `DELETE` select to include `post_id`:

```ts
    .select("id, author_id, body, post_id, removed_at")
```

Add `notify` to the forumApi import, then extend the `if (!own)` block (after `logMod`):

```ts
  if (!own) {
    await logMod(caller.profile.id, "remove_comment", "comment", id, {
      body: (comment.body as string | null)?.slice(0, 80) ?? null,
      reason,
    });
    await notify(
      comment.author_id as string,
      "mod_remove_comment",
      caller.profile.id,
      comment.post_id as string,
      id,
      { excerpt: (comment.body as string | null)?.slice(0, 140) ?? "[gif]", reason },
    );
  }
```

- [ ] **Step 5: Verify against the dev server**

Start the dev server (preview tools). Signed out: `GET /api/forum/notifications` → 401 `signed_out`. Then via SQL (MCP): insert a notification for your own profile, `GET` with your real browser session → row appears with `unread: 1`; `POST {"all":true}` → `{unread: 0}`. Delete the test row after.

- [ ] **Step 6: Gates + commit**

```bash
npm run lint && npm run build && npx vitest run
git add src/lib/forumApi.ts src/app/api/forum/notifications src/app/api/forum/posts src/app/api/forum/comments
git commit -m "Forum: notifications backend (route + mod-removal inserts)"
```

---

### Task 3: Header bell integration (TDD) + comment anchors

**Files:**
- Test: `src/lib/__tests__/forumNotifications.test.ts` (write FIRST)
- Create: `src/lib/forumNotifications.ts`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/forum/CommentNode.tsx` (anchor id)
- Modify: `src/components/forum/CommentThread.tsx` (hash scroll)

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/forumNotifications.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { mergeBellItems, toBellItems, type ForumNotification } from "../forumNotifications";
import { type Notice } from "../notifications";

const n = (over: Partial<ForumNotification> = {}): ForumNotification => ({
  id: 1,
  kind: "reply_post",
  post_id: "p1",
  comment_id: "c1",
  detail: { post_title: "Hello RV", excerpt: "nice rig" },
  read_at: null,
  created_at: "2026-07-11T00:00:00.000Z",
  actor_username: "andy",
  actor_avatar: null,
  ...over,
});

describe("toBellItems", () => {
  it("maps a post reply with actor, title sub and comment anchor", () => {
    const [item] = toBellItems([n()]);
    expect(item.text).toBe("u/andy replied to your post");
    expect(item.sub).toBe("Hello RV");
    expect(item.href).toBe("/community/post?id=p1#c-c1");
    expect(item.read).toBe(false);
    expect(item.icon).toBe("reply");
  });

  it("maps a comment reply with the excerpt as sub", () => {
    const [item] = toBellItems([n({ kind: "reply_comment" })]);
    expect(item.text).toBe("u/andy replied to your comment");
    expect(item.sub).toBe("nice rig");
  });

  it("keeps mod removals anonymous even if an actor leaks through", () => {
    const [item] = toBellItems([
      n({
        kind: "mod_remove_post",
        actor_username: "modguy",
        detail: { post_title: "Hello RV", reason: "spam" },
        read_at: "2026-07-11T01:00:00.000Z",
      }),
    ]);
    expect(item.text).toBe("Moderators removed your post");
    expect(item.text).not.toContain("modguy");
    expect(item.sub).toBe("“Hello RV” — spam");
    expect(item.read).toBe(true);
    expect(item.icon).toBe("removed");
  });

  it("falls back to /community when ids are missing", () => {
    const [item] = toBellItems([n({ post_id: null, comment_id: null })]);
    expect(item.href).toBe("/community");
  });
});

describe("mergeBellItems", () => {
  it("interleaves local notices and forum items newest-first", () => {
    const local: Notice[] = [
      { id: "l1", kind: "live", text: "X is live", at: 2000, read: true },
      { id: "l2", kind: "account", text: "Welcome!", at: 500, read: false },
    ];
    const forum = toBellItems([n({ id: 9, created_at: "1970-01-01T00:00:01.000Z" })]); // at=1000
    const merged = mergeBellItems(local, forum);
    expect(merged.map((m) => m.key)).toEqual(["local-l1", "forum-9", "local-l2"]);
    expect(merged[0].href).toBe("/account/notifications");
    expect(merged[0].icon).toBe("live");
  });
});
```

- [ ] **Step 2: Run it — must fail** (module doesn't exist)

Run: `npx vitest run src/lib/__tests__/forumNotifications.test.ts`
Expected: FAIL — cannot resolve `../forumNotifications`.

- [ ] **Step 3: Create `src/lib/forumNotifications.ts`**

```ts
import { forumFetch } from "@/lib/forum";
import { type Notice } from "@/lib/notifications";

/* Forum notifications (DB-backed, per-user) for the site header bell. Every
   fetch degrades to "none" — the Pages mirror has no API routes and the bell
   must never break. Mod removals render as "Moderators", never a name. */

export type ForumNotificationKind =
  | "reply_post"
  | "reply_comment"
  | "mod_remove_post"
  | "mod_remove_comment";

export type ForumNotification = {
  id: number;
  kind: ForumNotificationKind;
  post_id: string | null;
  comment_id: string | null;
  detail: { post_title?: string; excerpt?: string; reason?: string } | null;
  read_at: string | null;
  created_at: string;
  actor_username: string | null;
  actor_avatar: string | null;
};

/** One bell dropdown line — shared shape for local notices and forum rows. */
export type BellItem = {
  key: string;
  icon: "live" | "account" | "reply" | "removed";
  text: string;
  sub?: string;
  at: number;
  read: boolean;
  href: string;
};

export async function fetchForumNotifications(): Promise<{ items: BellItem[]; unread: number }> {
  try {
    const j = await forumFetch<{ notifications: ForumNotification[]; unread: number }>(
      "/api/forum/notifications",
    );
    return { items: toBellItems(j.notifications), unread: j.unread };
  } catch {
    return { items: [], unread: 0 };
  }
}

export async function markForumNotificationsRead(): Promise<void> {
  try {
    await forumFetch("/api/forum/notifications", {
      method: "POST",
      body: JSON.stringify({ all: true }),
    });
  } catch {
    /* mirror / offline — ignore */
  }
}

export function toBellItems(rows: ForumNotification[]): BellItem[] {
  return rows.map((n) => {
    const post = n.post_id ? `/community/post?id=${n.post_id}` : "/community";
    const href = n.post_id && n.comment_id ? `${post}#c-${n.comment_id}` : post;
    const title = n.detail?.post_title;
    const excerpt = n.detail?.excerpt;
    const reason = n.detail?.reason;
    const who = n.actor_username ?? "Someone";
    switch (n.kind) {
      case "reply_post":
        return item(n, "reply", `u/${who} replied to your post`, title ?? excerpt, href);
      case "reply_comment":
        return item(n, "reply", `u/${who} replied to your comment`, excerpt ?? title, href);
      case "mod_remove_post":
        return item(n, "removed", "Moderators removed your post", joinSub(title, reason), href);
      case "mod_remove_comment":
        return item(n, "removed", "Moderators removed your comment", joinSub(excerpt, reason), href);
    }
  });
}

export function noticeToBellItem(n: Notice): BellItem {
  return {
    key: `local-${n.id}`,
    icon: n.kind,
    text: n.text,
    ...(n.sub ? { sub: n.sub } : {}),
    at: n.at,
    read: n.read,
    href: "/account/notifications",
  };
}

export function mergeBellItems(local: Notice[], forum: BellItem[]): BellItem[] {
  return [...local.map(noticeToBellItem), ...forum].sort((a, b) => b.at - a.at);
}

function joinSub(what?: string, reason?: string): string | undefined {
  if (what && reason) return `“${what}” — ${reason}`;
  return reason ?? what;
}

function item(
  n: ForumNotification,
  icon: BellItem["icon"],
  text: string,
  sub: string | undefined,
  href: string,
): BellItem {
  return {
    key: `forum-${n.id}`,
    icon,
    text,
    ...(sub ? { sub } : {}),
    at: new Date(n.created_at).getTime(),
    read: n.read_at != null,
    href,
  };
}
```

- [ ] **Step 4: Run the test — must pass**

Run: `npx vitest run src/lib/__tests__/forumNotifications.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the bell in `src/components/Header.tsx`**

5a. Add after the existing `@/lib/notifications` import:

```ts
import {
  fetchForumNotifications,
  markForumNotificationsRead,
  mergeBellItems,
  type BellItem,
} from "@/lib/forumNotifications";
```

5b. Add two icon components after `StarIcon` (match its stroke style):

```tsx
function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M9 17l-5-5 5-5" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z" />
    </svg>
  );
}

function BellItemIcon({ icon }: { icon: BellItem["icon"] }) {
  if (icon === "live") return <LiveDotIcon />;
  if (icon === "reply") return <ReplyIcon />;
  if (icon === "removed") return <ShieldIcon />;
  return <StarIcon />;
}
```

5c. Add state below `const [notices, setNotices] = ...`:

```ts
  const [forumBell, setForumBell] = useState<{ items: BellItem[]; unread: number }>({
    items: [],
    unread: 0,
  });
```

5d. Add an effect below the notices effect (fetch when Kick-signed-in; refresh on window focus — async callbacks only, no sync setState in the effect body):

```ts
  // Forum notifications (server-backed) join the bell when Kick-signed-in.
  useEffect(() => {
    if (!kickUser) return;
    let stale = false;
    const load = () =>
      fetchForumNotifications().then((f) => {
        if (!stale) setForumBell(f);
      });
    load();
    window.addEventListener("focus", load);
    return () => {
      stale = true;
      window.removeEventListener("focus", load);
    };
  }, [kickUser]);
```

5e. Replace the unread calculation line:

```ts
  const unread = notices.filter((n) => !n.read).length;
```

with:

```ts
  const unread = notices.filter((n) => !n.read).length + forumBell.unread;
  const bellItems = mergeBellItems(notices, forumBell.items);
```

5f. Replace the "Mark all as read" button's `onClick={() => markAllRead()}` with:

```tsx
                    onClick={() => {
                      markAllRead();
                      markForumNotificationsRead();
                      setForumBell((prev) => ({
                        items: prev.items.map((i) => ({ ...i, read: true })),
                        unread: 0,
                      }));
                    }}
```

5g. Replace the dropdown list block — `{notices.length === 0 ? (...) : (notices.slice(0, 12).map((n) => (...)))}` — with the merged render (same classes, generic href/icon):

```tsx
                    {bellItems.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-faint">
                        No notifications yet.
                      </p>
                    ) : (
                      bellItems.slice(0, 12).map((n) => (
                        <Link
                          key={n.key}
                          href={n.href}
                          onClick={() => setMenu(null)}
                          className={`flex items-start gap-3 px-4 py-3 transition hover:bg-elevated ${
                            n.read ? "" : "bg-accent/5"
                          }`}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-elevated text-accent">
                            <BellItemIcon icon={n.icon} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {n.text}
                            </span>
                            {n.sub && (
                              <span className="block truncate text-xs text-dim">{n.sub}</span>
                            )}
                            <span className="mt-0.5 block text-[11px] text-neutral-600">
                              {timeAgo(n.at)}
                            </span>
                          </span>
                        </Link>
                      ))
                    )}
```

- [ ] **Step 6: Comment anchors** — in `src/components/forum/CommentNode.tsx` change the root div:

```tsx
    <div className="mt-3" id={`c-${c.id}`}>
```

- [ ] **Step 7: Hash scroll** — in `src/components/forum/CommentThread.tsx`, add below the thread-loading effect:

```ts
  // Deep-link (#c-{id} from bell links): scroll once the thread has rendered.
  const loaded = shown.rows !== null;
  useEffect(() => {
    if (!loaded) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#c-")) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [loaded]);
```

- [ ] **Step 8: Browser verify** — dev server, signed in (real session): insert a `reply_post` notification for your profile via MCP SQL → bell badge shows 1 → dropdown renders "u/… replied to your post" with the post title → click navigates to the post and scrolls to the comment → "Mark all as read" zeroes the badge (check the DB row's `read_at`). Signed out: bell area unchanged (no forum fetch — no `/api/forum/notifications` request in the network log). Delete the test row.

- [ ] **Step 9: Gates + commit**

```bash
npm run lint && npm run build && npx vitest run
git add src/lib/forumNotifications.ts src/lib/__tests__/forumNotifications.test.ts src/components/Header.tsx src/components/forum/CommentNode.tsx src/components/forum/CommentThread.tsx
git commit -m "Forum: header bell shows server notifications (merged w/ local notices)"
```

---

### Task 4: Post search (client + feed UI; RPC shipped in Task 1)

**Files:**
- Modify: `src/lib/forum.ts` (add `fetchSearch` + constants after `fetchFeed`)
- Modify: `src/components/forum/ForumFeed.tsx` (full replacement below)

- [ ] **Step 1: Add to `src/lib/forum.ts`** (below `fetchFeed`):

```ts
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
```

- [ ] **Step 2: Replace `src/components/forum/ForumFeed.tsx` entirely with:**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FEED_PAGE,
  SEARCH_MAX,
  SEARCH_PAGE,
  fetchFeed,
  fetchFlairs,
  fetchMyVotes,
  fetchSearch,
  nextCursor,
  type FeedCursor,
  type FeedPost,
  type FeedSort,
  type Flair,
  type VoteValue,
} from "@/lib/forum";
import { getMe } from "@/components/forum/useMe";
import { type VoteState } from "@/components/forum/VoteRail";
import FlairBar from "@/components/forum/FlairBar";
import PostCard from "@/components/forum/PostCard";

const SORTS: FeedSort[] = ["hot", "new", "top"];
const SORT_LABEL: Record<FeedSort, string> = { hot: "Hot", new: "New", top: "Top" };

type FeedState = {
  key: string; // `${sort}|${flair}|${q}` — a key mismatch means "stale, show skeletons"
  posts: FeedPost[] | null;
  done: boolean;
  error: string | null;
};

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-faint"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.2-4.2" />
    </svg>
  );
}

/** Uncontrolled search box — debounced pushes into the ?q= URL param. */
function SearchInput({ active, onSearch }: { active: string; onSearch: (q: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="flex items-center gap-2 rounded-full border border-line px-3">
      <SearchIcon />
      <input
        ref={ref}
        defaultValue={active}
        onChange={(e) => {
          const v = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onSearch(v.trim()), 350);
        }}
        placeholder="Search posts…"
        aria-label="Search posts"
        className="w-32 bg-transparent py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 sm:w-44"
      />
      {active && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            if (ref.current) ref.current.value = "";
            onSearch("");
          }}
          className="text-sm font-bold text-neutral-500 transition-colors hover:text-neutral-200"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function ForumFeed() {
  const router = useRouter();
  const params = useSearchParams();
  const rawSort = params.get("sort") as FeedSort | null;
  const sort: FeedSort = rawSort && SORTS.includes(rawSort) ? rawSort : "hot";
  const flairParam = params.get("flair");
  const flair = flairParam ? Number(flairParam) || null : null;
  const q = (params.get("q") ?? "").trim();
  const key = `${sort}|${flair ?? ""}|${q}`;

  const [flairs, setFlairs] = useState<Flair[]>([]);
  // Reset-on-filter-change is *derived* from the key (no setState in effects):
  // state tagged with a stale key renders as if it were the fresh empty state.
  const [feed, setFeed] = useState<FeedState>({ key, posts: null, done: false, error: null });
  const [voteState, setVoteState] = useState<Record<string, VoteState>>({});
  const shown: FeedState =
    feed.key === key ? feed : { key, posts: null, done: false, error: null };
  const cursor = useRef<FeedCursor>(null);
  const offset = useRef(0);
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const setQuery = (nextSort: FeedSort, nextFlair: number | null, nextQ: string) => {
    const p = new URLSearchParams();
    if (nextSort !== "hot") p.set("sort", nextSort);
    if (nextFlair != null) p.set("flair", String(nextFlair));
    if (nextQ) p.set("q", nextQ);
    router.replace(`/community${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  const loadMore = useCallback(
    async (reset: boolean) => {
      if (loading.current) return;
      loading.current = true;
      try {
        let page: FeedPost[];
        let done: boolean;
        if (q) {
          const from = reset ? 0 : offset.current;
          page = await fetchSearch(q, flair, from);
          offset.current = from + page.length;
          done = page.length < SEARCH_PAGE || offset.current >= SEARCH_MAX;
        } else {
          page = await fetchFeed(sort, flair, reset ? null : cursor.current);
          cursor.current = nextCursor(sort, page);
          done = page.length < FEED_PAGE;
        }
        setFeed((prev) => {
          const base = !reset && prev.key === key && prev.posts ? prev.posts : [];
          return { key, posts: [...base, ...page], done, error: null };
        });
        // hydrate the caller's votes for this page (no-op signed out / on the mirror)
        const meRes = await getMe();
        if (!("signedOut" in meRes) && page.length) {
          const mine = await fetchMyVotes("post", page.map((p) => p.id));
          setVoteState((prev) => {
            const next = { ...prev };
            for (const p of page) {
              if (!next[p.id]) {
                next[p.id] = { score: p.score, myVote: (mine[p.id] ?? 0) as VoteValue };
              }
            }
            return next;
          });
        }
      } catch (e) {
        setFeed((prev) => ({
          key,
          posts: prev.key === key ? prev.posts : null,
          done: false,
          error: (e as Error).message,
        }));
      } finally {
        loading.current = false;
      }
    },
    [sort, flair, q, key],
  );

  useEffect(() => {
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);

  useEffect(() => {
    cursor.current = null;
    offset.current = 0;
    loadMore(true);
  }, [loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown.done || shown.error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore(false);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, shown.done, shown.error, shown.posts?.length]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {!q && (
          <div className="flex rounded-full border border-line p-0.5">
            {SORTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s, flair, q)}
                className={`rounded-full px-3.5 py-1 text-sm font-semibold transition-colors ${
                  s === sort ? "bg-accent text-accent-ink" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {SORT_LABEL[s]}
              </button>
            ))}
          </div>
        )}
        <SearchInput
          key={`${sort}|${flair ?? ""}`}
          active={q}
          onSearch={(nq) => setQuery(sort, flair, nq)}
        />
        <div className="min-w-0 flex-1">
          <FlairBar flairs={flairs} active={flair} onPick={(id) => setQuery(sort, id, q)} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {shown.posts === null &&
          !shown.error &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-panel" />
          ))}

        {shown.error && (
          <div className="rounded-xl border border-line bg-panel p-6 text-center">
            <p className="text-sm text-neutral-400">Couldn&apos;t load the feed: {shown.error}</p>
            <button
              type="button"
              onClick={() => loadMore(shown.posts === null)}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
            >
              Try again
            </button>
          </div>
        )}

        {shown.posts?.map((p) => {
          const vs = voteState[p.id];
          return (
            <PostCard
              key={p.id}
              post={vs ? { ...p, score: vs.score } : p}
              myVote={vs?.myVote ?? 0}
              onVote={(next) => setVoteState((prev) => ({ ...prev, [p.id]: next }))}
              onModRemoved={() =>
                setFeed((prev) =>
                  prev.key === key
                    ? { ...prev, posts: (prev.posts ?? []).filter((x) => x.id !== p.id) }
                    : prev,
                )
              }
            />
          );
        })}

        {shown.posts !== null && shown.posts.length === 0 && !shown.error && (
          <div className="rounded-xl border border-line bg-panel p-10 text-center text-neutral-500">
            {q
              ? `No posts match “${q}”.`
              : `No posts ${flair != null ? "with this flair " : ""}yet — be the first!`}
          </div>
        )}

        {shown.done && shown.posts !== null && shown.posts.length > 0 && (
          <p className="py-4 text-center text-xs text-neutral-600">You&apos;re all caught up.</p>
        )}
        <div ref={sentinel} />
      </div>
    </div>
  );
}
```

Known accepted edge: the search input is uncontrolled — browser back/forward changing `?q=` doesn't rewrite the input text (state stays URL-first; typing again resyncs).

- [ ] **Step 3: Browser verify** — seed a distinctive post via MCP SQL (title "Quantum chicken coop tips", any flair, your profile). On `/community`: type "quantum" → results replace the feed, sort pills hide, URL shows `?q=quantum`; direct-load that URL → same results; combine with a flair chip → filters; type gibberish ("zzqqxx") → "No posts match" card; clear (×) → normal feed returns. Delete the seed post after (SQL: delete post row; it has no votes/comments).

- [ ] **Step 4: Gates + commit**

```bash
npm run lint && npm run build && npx vitest run
git add src/lib/forum.ts src/components/forum/ForumFeed.tsx
git commit -m "Forum: full-text post search (ranked RPC + ?q= feed mode)"
```

---

### Task 5: Realtime — broadcast pings + live consumers

**Files:**
- Create: `src/lib/forumRealtime.ts`
- Create: `src/lib/forumLive.ts`
- Modify: `src/app/api/forum/comments/route.ts`, `src/app/api/forum/votes/route.ts`, `src/app/api/forum/posts/route.ts`, `src/app/api/forum/posts/[id]/route.ts`, `src/app/api/forum/comments/[id]/route.ts`
- Modify: `src/components/forum/PostView.tsx`, `src/components/forum/CommentThread.tsx`, `src/components/forum/ForumFeed.tsx`, `src/components/Header.tsx`

- [ ] **Step 1: Create `src/lib/forumRealtime.ts`** (server-only, like `supabaseAdmin`)

```ts
/* Server-side Realtime broadcast pings (plan 06) — content-free "something
   changed" events on public channels. Clients refetch through the masked
   views/RPCs; payloads carry ids only, so a channel snoop learns nothing
   beyond public activity. Best-effort like logMod: a lost ping just degrades
   to fetch-on-focus. */

export async function broadcastPing(
  topic: string,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
    });
  } catch {
    /* best-effort */
  }
}
```

- [ ] **Step 2: Create `src/lib/forumLive.ts`** (client hook)

```ts
"use client";

import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase";

/* Live pings (plan 06): subscribe to a public broadcast topic and re-fetch on
   activity. Coalesces bursts so a voting spree causes one refetch, not ten.
   Pass coalesceMs=0 when every ping matters (e.g. counting new posts). */

export function useLiveChannel(
  topic: string | null,
  events: string[],
  onPing: (event: string, payload: Record<string, unknown>) => void,
  coalesceMs = 3000,
): void {
  const cb = useRef(onPing);
  cb.current = onPing;
  const gate = useRef<{ last: number; timer: ReturnType<typeof setTimeout> | null }>({
    last: 0,
    timer: null,
  });
  const eventsKey = events.join(",");

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !topic) return;
    const fire = (event: string, payload: Record<string, unknown>) => {
      if (coalesceMs <= 0) {
        cb.current(event, payload);
        return;
      }
      const now = Date.now();
      const g = gate.current;
      if (now - g.last >= coalesceMs) {
        g.last = now;
        cb.current(event, payload);
      } else if (!g.timer) {
        g.timer = setTimeout(() => {
          g.timer = null;
          g.last = Date.now();
          cb.current(event, payload);
        }, coalesceMs - (now - g.last));
      }
    };
    let channel = sb.channel(topic);
    for (const event of eventsKey.split(",").filter(Boolean)) {
      channel = channel.on("broadcast", { event }, (msg) =>
        fire(event, ((msg as { payload?: Record<string, unknown> }).payload ?? {})),
      );
    }
    channel.subscribe();
    const g = gate.current;
    return () => {
      if (g.timer) clearTimeout(g.timer);
      g.timer = null;
      sb.removeChannel(channel);
    };
  }, [topic, eventsKey, coalesceMs]);
}
```

- [ ] **Step 3: Ping sites in the write routes** (each is an addition just before the final `return Response.json(...)` of the handler; add `import { broadcastPing } from "@/lib/forumRealtime";` to each file)

`src/app/api/forum/comments/route.ts` POST — after the RPC succeeds, before `return Response.json(data)`:

```ts
  // Live pings + notification fan-out — awaited before the response so
  // serverless doesn't kill them mid-flight. All best-effort.
  const commentId = (data as { id?: string })?.id;
  if (commentId) {
    await broadcastPing(`post:${postId}`, "comments", { comment_id: commentId });
    const { data: notifRows } = await admin
      .from("notifications")
      .select("profile_id")
      .eq("comment_id", commentId);
    const recipientIds = (notifRows ?? []).map((n) => n.profile_id as string);
    if (recipientIds.length) {
      const { data: recipients } = await admin
        .from("profiles")
        .select("kick_id")
        .in("id", recipientIds);
      for (const r of recipients ?? []) {
        await broadcastPing(`user:${r.kick_id}`, "notif", {});
      }
    }
  }
```

`src/app/api/forum/votes/route.ts` POST — before the final `return Response.json(row ?? …)`:

```ts
  // Ping the thread the vote lives in (comment votes need the parent post id).
  let postTopicId = id;
  if (type === "comment") {
    const { data: c } = await admin.from("comments").select("post_id").eq("id", id).maybeSingle();
    postTopicId = (c?.post_id as string) ?? "";
  }
  if (postTopicId) await broadcastPing(`post:${postTopicId}`, "votes", {});
```

`src/app/api/forum/posts/route.ts` POST — before `return Response.json({ id: post.id })`:

```ts
  await broadcastPing("feed", "posts", { post_id: post.id });
```

`src/app/api/forum/posts/[id]/route.ts` DELETE — extend the `if (!own)` block from Task 2 and ping the thread. The full end of the handler becomes:

```ts
  if (!own) {
    await logMod(caller.profile.id, "remove_post", "post", id, { title: post.title, reason });
    await notify(post.author_id as string, "mod_remove_post", caller.profile.id, id, null, {
      post_title: post.title,
      reason,
    });
    const { data: author } = await admin
      .from("profiles")
      .select("kick_id")
      .eq("id", post.author_id)
      .maybeSingle();
    if (author) await broadcastPing(`user:${author.kick_id}`, "notif", {});
  }
  await broadcastPing(`post:${id}`, "removed", {});
  return Response.json({ ok: true });
```

`src/app/api/forum/comments/[id]/route.ts` DELETE — same pattern; the full end of the handler becomes:

```ts
  if (!own) {
    await logMod(caller.profile.id, "remove_comment", "comment", id, {
      body: (comment.body as string | null)?.slice(0, 80) ?? null,
      reason,
    });
    await notify(
      comment.author_id as string,
      "mod_remove_comment",
      caller.profile.id,
      comment.post_id as string,
      id,
      { excerpt: (comment.body as string | null)?.slice(0, 140) ?? "[gif]", reason },
    );
    const { data: author } = await admin
      .from("profiles")
      .select("kick_id")
      .eq("id", comment.author_id)
      .maybeSingle();
    if (author) await broadcastPing(`user:${author.kick_id}`, "notif", {});
  }
  await broadcastPing(`post:${comment.post_id}`, "comments", {});
  return Response.json({ ok: true });
```

- [ ] **Step 4: Live thread in `src/components/forum/PostView.tsx` + `CommentThread.tsx`**

`CommentThread.tsx`: add a `refreshKey` prop and include it in the fetch effect deps (a bump silently refetches — rows are only replaced on completion, so no skeleton flash):

```tsx
export default function CommentThread({
  postId,
  refreshKey = 0,
  onCountChange,
}: {
  postId: string;
  refreshKey?: number;
  onCountChange?: (delta: number) => void;
}) {
```

and change the effect's dependency array from `[postId]` to `[postId, refreshKey]`.

`PostView.tsx`: add ONE new import (`fetchPost` is already imported in this file — do not re-import it):

```ts
import { useLiveChannel } from "@/lib/forumLive";
```

add state + subscription after the existing `useEffect`:

```ts
  const [liveNonce, setLiveNonce] = useState(0);
  useLiveChannel(id ? `post:${id}` : null, ["comments", "votes", "removed"], () => {
    if (!id) return;
    fetchPost(id)
      .then((p) => {
        setResult((prev) => (prev && prev.id === id ? { id, post: p } : prev));
        if (p) {
          setVote((prev) =>
            prev && prev.id === id ? { id, state: { ...prev.state, score: p.score } } : prev,
          );
          setLiveNonce((x) => x + 1);
        }
      })
      .catch(() => {});
  });
```

and pass it down: `<CommentThread postId={post.id} refreshKey={liveNonce} onCountChange={...} />`.

(A `removed` ping makes `fetchPost` return null → the existing "This post doesn't exist (or was removed)" card renders.)

- [ ] **Step 5: "New posts" pill in `src/components/forum/ForumFeed.tsx`**

Add import: `import { useLiveChannel } from "@/lib/forumLive";`

Add state + subscription below `const [voteState, ...]` (subscribe only when not searching; count every ping):

```ts
  const [pendingLive, setPendingLive] = useState(0);
  useLiveChannel(q ? null : "feed", ["posts"], () => setPendingLive((n) => n + 1), 0);
```

Render the pill at the top of the list container — directly after `<div className="mt-4 space-y-3">`:

```tsx
        {pendingLive > 0 && !q && (
          <button
            type="button"
            onClick={() => {
              setPendingLive(0);
              cursor.current = null;
              offset.current = 0;
              loadMore(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="mx-auto flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink shadow-lg transition hover:bg-accent-soft"
          >
            {pendingLive} new post{pendingLive === 1 ? "" : "s"} — show
          </button>
        )}
```

- [ ] **Step 6: Live bell count in `src/components/Header.tsx`**

Add imports:

```ts
import { getMe } from "@/components/forum/useMe";
import { useLiveChannel } from "@/lib/forumLive";
```

Add below the `forumBell` state:

```ts
  const [forumKickId, setForumKickId] = useState<number | null>(null);
```

Add below the Task-3 forum-notifications effect:

```ts
  // Resolve the numeric kick id (shared /me fetch) to join the user channel.
  useEffect(() => {
    if (!kickUser) return;
    let stale = false;
    getMe().then((m) => {
      if (!stale && !("signedOut" in m)) setForumKickId(m.profile.kickId);
    });
    return () => {
      stale = true;
    };
  }, [kickUser]);
  useLiveChannel(forumKickId ? `user:${forumKickId}` : null, ["notif"], () => {
    fetchForumNotifications().then(setForumBell);
  });
```

- [ ] **Step 7: Two-tab browser verify.** Front tab A on a post page, tab B same post. Post a comment via `curl` with a minted cookie (Task 7 script) → tab A shows the new comment within ~3s without reload; comment on your own post as the test user → your bell badge increments live; open `/community` and create a post via curl → "1 new post — show" pill appears, click loads it on top. If pings don't arrive: check the browser websocket (Network tab, `realtime/v1/websocket`), confirm the REST call returns 202 (log its status once in dev), and re-read the docs note in the header of this plan before changing anything.

- [ ] **Step 8: Gates + commit**

```bash
npm run lint && npm run build && npx vitest run
git add src/lib/forumRealtime.ts src/lib/forumLive.ts src/app/api/forum src/components/forum/PostView.tsx src/components/forum/CommentThread.tsx src/components/forum/ForumFeed.tsx src/components/Header.tsx
git commit -m "Forum: realtime broadcast pings (live threads, feed pill, live bell)"
```

---

### Task 6: Reports — user reporting + mod queue

**Files:**
- Create: `src/app/api/forum/reports/route.ts`
- Create: `src/app/api/forum/mod/reports/route.ts`
- Modify: `src/app/api/forum/posts/[id]/route.ts`, `src/app/api/forum/comments/[id]/route.ts` (auto-resolve)
- Modify: `src/lib/forum.ts` (client fns)
- Create: `src/components/forum/ReportDialog.tsx`
- Modify: `src/components/forum/PostCard.tsx`, `src/components/forum/CommentNode.tsx` (Report action)
- Modify: `src/components/forum/ModTools.tsx` (Reports tab)

- [ ] **Step 1: Create `src/app/api/forum/reports/route.ts`**

```ts
import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = new Set(["spam", "harassment", "nsfw", "misinfo", "other"]);
const UUID = /^[0-9a-f-]{36}$/i;
const MAX_DETAIL = 500;
const MAX_OPEN = 25;

/** POST { subject_type, subject_id, reason, detail? } → {ok} | {already}. */
export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { subject_type?: unknown; subject_id?: unknown; reason?: unknown; detail?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const type = String(raw.subject_type ?? "");
  const id = String(raw.subject_id ?? "");
  const reason = String(raw.reason ?? "");
  const detail = typeof raw.detail === "string" ? raw.detail.trim().slice(0, MAX_DETAIL) : "";
  if (!["post", "comment"].includes(type) || !UUID.test(id) || !REASONS.has(reason)) {
    return jsonError(400, "bad_request", "Invalid report.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const table = type === "post" ? "posts" : "comments";
  const { data: subject, error: subjErr } = await admin
    .from(table)
    .select("id, author_id, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (subjErr) return jsonError(500, "db_error", subjErr.message);
  if (!subject || subject.removed_at) return jsonError(404, "not_found", "That content is gone.");
  if (subject.author_id === caller.profile.id) {
    return jsonError(400, "own_content", "You can't report your own content.");
  }

  const { count } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", caller.profile.id)
    .is("resolved_at", null);
  if ((count ?? 0) >= MAX_OPEN) {
    return jsonError(429, "too_many_reports", "You have a lot of open reports — the mods are on it.");
  }

  const { error } = await admin.from("reports").insert({
    reporter_id: caller.profile.id,
    subject_type: type,
    subject_id: id,
    reason,
    detail: detail || null,
  });
  if (error) {
    if (error.code === "23505") return Response.json({ already: true }); // open-report dedupe
    return jsonError(500, "db_error", error.message);
  }
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Create `src/app/api/forum/mod/reports/route.ts`**

```ts
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

  // Content previews (including already-removed state) + usernames.
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
```

- [ ] **Step 3: Auto-resolve on removal.** In BOTH `src/app/api/forum/posts/[id]/route.ts` and `src/app/api/forum/comments/[id]/route.ts` `DELETE` handlers, directly after the soft-removal `update` succeeds (`if (updError) ...` check) and before the `if (!own)` block, add (posts version shown; comments version uses `"comment"`):

```ts
  // Removal resolves any open reports on this content (best-effort).
  await admin
    .from("reports")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: caller.profile.id,
      resolution: "removed",
    })
    .eq("subject_type", "post")
    .eq("subject_id", id)
    .is("resolved_at", null);
```

- [ ] **Step 4: Client fns in `src/lib/forum.ts`** (append in the moderation section)

```ts
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
```

- [ ] **Step 5: Create `src/components/forum/ReportDialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { appOrigin, reportContent, type ReportReason, type SubjectType } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { useMe } from "@/components/forum/useMe";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam or self-promotion" },
  { id: "harassment", label: "Harassment or abuse" },
  { id: "nsfw", label: "NSFW or inappropriate" },
  { id: "misinfo", label: "Misinformation" },
  { id: "other", label: "Something else" },
];

/** Modal report form. Handles its own auth gate (signed-out → Kick sign-in,
    or a deep-link to the Vercel origin from the static mirror). */
export default function ReportDialog({
  type,
  id,
  onClose,
}: {
  type: SubjectType;
  id: string;
  onClose: () => void;
}) {
  const me = useMe();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedOut = me !== null && "signedOut" in me;

  function signIn() {
    const origin = appOrigin();
    if (origin) window.location.href = `${origin}/community`;
    else if (kickLoginConfigured()) startKickLogin();
  }

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reportContent(type, id, reason, detail.trim());
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Report this ${type}`}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-4 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <p className="font-bold text-neutral-100">Reported — thanks.</p>
            <p className="mt-1 text-sm text-neutral-400">The mod team will take a look.</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft"
              >
                Close
              </button>
            </div>
          </>
        ) : signedOut ? (
          <>
            <p className="font-bold text-neutral-100">Sign in to report</p>
            <p className="mt-1 text-sm text-neutral-400">
              Reports need a Kick sign-in so the mods can weigh them.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={signIn}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft"
              >
                Sign in with Kick
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-bold text-neutral-100">Report this {type}</p>
            <div className="mt-3 space-y-1.5">
              {REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    reason === r.id
                      ? "border-accent bg-accent/10 text-neutral-100"
                      : "border-line text-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="accent-[#e3b23c]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={detail}
              maxLength={500}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              placeholder="Anything the mods should know? (optional)"
              className="mt-3 w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
            />
            {error && <p className="mt-2 text-xs text-mature">{error}</p>}
            <div className="mt-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason || busy}
                onClick={submit}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft disabled:opacity-40"
              >
                Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Report action on `src/components/forum/PostCard.tsx`**

Add imports + state:

```ts
import { useState } from "react";
import ReportDialog from "@/components/forum/ReportDialog";
```

```ts
  const [reporting, setReporting] = useState(false);
```

In the actions row, after the comments `<Link>` and before the `{isMod && !own && (...)}` block, add (shown to everyone except the author — signed-out users get the dialog's sign-in gate):

```tsx
          {!own && (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="transition-colors hover:text-neutral-300"
            >
              Report
            </button>
          )}
```

And before the closing `</article>` tag:

```tsx
      {reporting && (
        <ReportDialog type="post" id={post.id} onClose={() => setReporting(false)} />
      )}
```

- [ ] **Step 7: Report action on `src/components/forum/CommentNode.tsx`**

Add import: `import ReportDialog from "@/components/forum/ReportDialog";` and state next to the others:

```ts
  const [reporting, setReporting] = useState(false);
```

In the action row, after the Reply button and before `{mine && (...)}`:

```tsx
                  {!mine && (
                    <button
                      type="button"
                      onClick={() => setReporting(true)}
                      className="transition-colors hover:text-neutral-300"
                    >
                      Report
                    </button>
                  )}
```

And directly before the `{replying && (...)}` block:

```tsx
              {reporting && (
                <ReportDialog type="comment" id={c.id} onClose={() => setReporting(false)} />
              )}
```

- [ ] **Step 8: Reports tab in `src/components/forum/ModTools.tsx`**

Update the imports from `@/lib/forum`:

```ts
import {
  dismissReports,
  fetchFlairs,
  fetchModReports,
  forumFetch,
  modRemove,
  timeAgo,
  type Flair,
  type ModReportGroup,
} from "@/lib/forum";
```

Change the tab type and tabs array:

```ts
type Tab = "reports" | "queue" | "bans" | "flairs" | "roles";
```

```ts
  const tabs: { id: Tab; label: string }[] = [
    { id: "reports", label: "Reports" },
    { id: "queue", label: "Queue" },
    { id: "bans", label: "Bans" },
    { id: "flairs", label: "Flairs" },
    { id: "roles", label: "Roles" },
  ];
```

Add the tab render line alongside the others: `{tab === "reports" && <Reports />}` — and add the component (below `Queue`):

```tsx
function Reports() {
  const [groups, setGroups] = useState<ModReportGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchModReports()
      .then(setGroups)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function dismiss(g: ModReportGroup) {
    try {
      setError(null);
      await dismissReports(g.subject_type, g.subject_id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function removeContent(g: ModReportGroup) {
    const reason = window.prompt("Removal reason:");
    if (reason == null) return;
    try {
      setError(null);
      await modRemove(g.subject_type, g.subject_id, reason.trim());
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <p className="mt-4 text-sm text-mature">{error}</p>;
  if (!groups) return <div className="mt-4 h-32 animate-pulse rounded-lg bg-white/5" />;
  return (
    <div className="mt-4 space-y-2 text-xs">
      {groups.length === 0 && <p className="text-neutral-600">No open reports. Quiet day.</p>}
      {groups.map((g) => {
        const href =
          g.subject_type === "post"
            ? `/community/post?id=${g.subject_id}`
            : g.preview && "post_id" in g.preview
              ? `/community/post?id=${g.preview.post_id}#c-${g.subject_id}`
              : "/community";
        return (
          <div key={`${g.subject_type}:${g.subject_id}`} className="rounded-lg border border-line bg-panel p-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-mature/15 px-1.5 py-px text-[10px] font-bold uppercase text-mature">
                {g.count} report{g.count === 1 ? "" : "s"}
              </span>
              <span className="text-neutral-500">
                {Object.entries(g.reasons)
                  .map(([r, c]) => `${r} ×${c}`)
                  .join(" · ")}
              </span>
              <span className="flex-1" />
              <span className="text-neutral-600">{timeAgo(g.last_at)} ago</span>
            </div>
            <p className="mt-1.5 font-semibold text-neutral-200">
              {g.preview
                ? "title" in g.preview
                  ? g.preview.title
                  : g.preview.body
                : "(content unavailable)"}
              {g.preview?.removed && (
                <span className="ml-2 rounded bg-white/10 px-1 py-px text-[9px] font-bold uppercase text-neutral-400">
                  already removed
                </span>
              )}
            </p>
            <p className="mt-0.5 text-neutral-500">
              {g.subject_type} by u/{g.preview?.author_username ?? "?"} · reported by{" "}
              {g.reporters.map((r) => `u/${r}`).join(", ")}
              {g.details.length > 0 && (
                <>
                  {" "}
                  · <span className="italic">“{g.details[0]}”</span>
                </>
              )}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Link href={href} className="text-accent hover:underline">
                View
              </Link>
              <span className="flex-1" />
              <button type="button" onClick={() => dismiss(g)} className={btnCls}>
                Dismiss
              </button>
              {!g.preview?.removed && (
                <button
                  type="button"
                  onClick={() => removeContent(g)}
                  className={`${btnCls} hover:text-mature`}
                >
                  Remove content
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 9: Browser verify** — as your admin session: Report is hidden on your own posts, visible on others'. Report a seeded dummy post (radio + detail) → "Reported — thanks"; repeat → same message (server said `already`). ModTools → Reports tab: group card shows count/reason/reporter/preview → Dismiss clears it (DB: `resolution='dismissed'`); re-report → Remove content → card clears, feed hides the post, DB shows `resolution='removed'` and the dummy author has a `mod_remove_post` notification. Signed out (incognito): Report button → sign-in gate. Guard checks via curl: report own content → 400 `own_content`.

- [ ] **Step 10: Gates + commit**

```bash
npm run lint && npm run build && npx vitest run
git add src/app/api/forum/reports src/app/api/forum/mod/reports src/app/api/forum/posts src/app/api/forum/comments src/lib/forum.ts src/components/forum/ReportDialog.tsx src/components/forum/PostCard.tsx src/components/forum/CommentNode.tsx src/components/forum/ModTools.tsx
git commit -m "Forum: report queue (user reports + mod triage tab + auto-resolve)"
```

---

### Task 7: E2E, deploy, prod smoke, memory

**Files:** none new (scratchpad script only)

- [ ] **Step 1: Cookie mint script** (scratchpad, NOT the repo) — `mint-session.mjs`:

```js
import { createHmac } from "node:crypto";
const secret = process.env.FORUM_SESSION_SECRET;
if (!secret) throw new Error("FORUM_SESSION_SECRET missing");
const kickId = Number(process.argv[2] ?? 999999001);
const username = process.argv[3] ?? "ForumTestUser";
const iat = Math.floor(Date.now() / 1000);
const payload = { kickId, username, avatar: null, iat, exp: iat + 3600 };
const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
const mac = createHmac("sha256", secret).update(body).digest().toString("base64url");
console.log(`forum_session=${body}.${mac}`);
```

Run: `node --env-file=.env.local mint-session.mjs 999999001 ForumTestUser` (and once with the real admin kick id for an admin cookie if the live browser session isn't available). Matches `signForumSession` exactly (HMAC over the base64url body).

- [ ] **Step 2: Seed** via MCP SQL: upsert dummy profile (`kick_id 999999001`, username `ForumTestUser`, role `user`); note your admin profile id (kick 56698434). Create one post by the admin and one by the dummy (via API with cookies, or SQL inserts + correct `kind='text'`).

- [ ] **Step 3: Full E2E sweep** (dev server; record every created row id for cleanup):
  1. **Notifications:** dummy comments on the admin post (curl + cookie) → admin bell badge 1 → dropdown item "u/ForumTestUser replied to your post" → click → post page scrolls to the comment → Mark all as read → badge 0, DB `read_at` set. Nested reply by admin under the dummy's comment → dummy gets `reply_comment` (SQL check). Self-reply (admin under own post, top-level) → NO notification row.
  2. **Realtime:** two tabs (front each before asserting — background tabs throttle): comment via curl → open thread updates in ~3s; feed pill on `/community` after a curl post; bell badge bumps live on a new reply.
  3. **Search:** "quantum"-style seeded title findable; `?q=` deep link; flair+search combo; gibberish → empty state; mirror simulation optional (search is anon-read, prod mirror check in Step 6).
  4. **Reports:** dummy reports admin's post → dedupe on repeat (`already`) → own-content 400 → admin ModTools Reports shows group → Dismiss → re-report → Remove content → auto-resolve `removed` + author notification + thread `removed` ping (open tab shows the removed card).
- [ ] **Step 4: Cleanup** via SQL: delete test notifications, reports, comments, posts (and their `media_attachments` if any), the dummy profile, and this session's `mod_log` rows (match on the test subject ids). Fix `comment_count`/karma drift only if any test rows were deleted bypassing the normal flows.
- [ ] **Step 5: Gates + push**

```bash
npm run lint && npm run build && npx vitest run
git push
```

Push auto-deploys Vercel + Pages (mirror strips `/api`). Watch the Pages workflow (`gh run list --limit 1` until complete).

- [ ] **Step 6: Prod smoke:** `https://chickenwebsite.vercel.app` — signed out `GET /api/forum/notifications` → 401; `/community?q=welcome` returns the welcome post; report button visible signed-out and gates to sign-in; bell + live updates with the user's real session (ask the user to confirm their bell if no live session is available). Pages mirror: search works, bell shows local notices only, no console errors.
- [ ] **Step 7:** Update auto-memory (`community-forum.md`): plan 06 shipped — notifications/realtime/search/reports, migration 0003 applied, any new gotchas discovered. Final report to the user.

---

## Self-review notes

- **Spec coverage:** §4 migration → Task 1; §6 notifications routes + removal integration → Task 2 (+ Task 5 pings, Task 6 auto-resolve); §7 bell/anchors → Task 3; §5 realtime (server lib, ping sites, hook, thread/feed/bell consumers) → Task 5; §7 SearchBar/feed → Task 4; §6+§7 reports + ModTools → Task 6; §9 testing + §10 rollout → per-task verifies + Task 7. Spec's "banned may read notifications" → Task 2 GET has no ban gate. Spec's mark-read-on-open was corrected to match the real Header (explicit "Mark all as read" button) — spec amended alongside this plan.
- **Type consistency:** `BellItem`/`ForumNotification`/`toBellItems`/`mergeBellItems` (lib + tests + Header), `broadcastPing(topic, event, payload)` everywhere, `useLiveChannel(topic, events, onPing, coalesceMs)` in PostView/ForumFeed/Header, `ModReportGroup` (forum.ts ↔ ModTools), `notify(profileId, kind, actorId, postId, commentId, detail)` in both DELETE routes, `refreshKey` prop name in PostView ↔ CommentThread.
- **Ordering note:** Task 5's ForumFeed edits assume Task 4's rewritten file (pill inserts after the `mt-4 space-y-3` container). Task 6's DELETE-route edits build on Task 2's (`notify`) and Task 5's (`broadcastPing`) versions of those files; the "full end of handler" blocks in Task 5 are the authoritative shape.
- **No placeholders:** every code step is complete; the only execution-time discovery is confirming broadcast delivery (Task 5 Step 7 gives the debug path).
