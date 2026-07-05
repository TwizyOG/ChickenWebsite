# Community Forum — Plan 01: Foundation + Text Forum

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the forum foundation (full DB schema, Kick→forum identity bridge, session cookie) plus a working text-post forum at `/community`: feed with Hot/New/Top + flair filtering, submit page, post detail page.

**Architecture:** Hybrid per `docs/superpowers/specs/2026-07-05-community-forum-design.md` — anon-key client reads via masked views/RPCs under RLS; writes via `/api/forum/*` Vercel routes authenticated by an HMAC-signed `forum_session` cookie minted in the existing Kick OAuth callback; service-role key server-side only. The **entire** schema (incl. comments/votes/bans, used by later plans) lands in one migration now.

**Tech Stack:** Next.js 16.2.10 App Router (async `params`/`searchParams` promises!), React 19, Tailwind v4 tokens (`bg-panel`, `border-line`, `text-accent`, `text-accent-ink`, `bg-accent-soft`), `@supabase/supabase-js` v2, vitest (new devDep), Node `crypto` for HMAC.

**Plan series:** 01 foundation+text (this) → 02 comments+votes → 03 media → 04 GIFs+hovercards → 05 moderation. Later plans are written after this one ships so their code matches reality.

**Spec deltas (agreed):** `get_thread`/`get_profile_stats` RPCs are replaced by direct selects on granted views (`comments_thread`, `profiles_public`) — same security posture, less SQL. Post detail lives at `/community/post?id=<uuid>` (query param, not `[id]` segment) — matches the repo convention (no dynamic segments anywhere) and keeps the static Pages export working.

**Conventions for every task:**
- Path alias `@/*` → `./src/*`. All API routes: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";` like the existing Kick routes.
- Commit after every task with the exact message given. Never `--no-verify`.
- `npx tsc --noEmit` must be clean before each commit (repo has no test-blocking hooks; this is our gate).
- Dev-server checks need `.env.local` values from Task 1. If they are missing, do the code + unit-test steps, mark the dev-server check as pending, and tell the user what's blocked.

---

### Task 1: Credentials + env wiring (USER CHECKPOINT)

**Files:**
- Modify: `.env.local` (values from the user — never committed; it is gitignored)
- Create: `docs/forum-setup.md`

- [ ] **Step 1: Try pulling Vercel envs**

Run: `npx vercel env pull .env.local --yes`
Expected: either `.env.local` gains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (project is Vercel-linked, `.vercel/project.json` exists), or auth error → ask the user to paste values instead.

- [ ] **Step 2: Generate the session secret**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Keep the output for Step 3 and give it to the user for Vercel.

- [ ] **Step 3: Write the setup doc**

Create `docs/forum-setup.md`:

```markdown
# Forum setup (one-time)

## 1. Vercel env vars (Project → Settings → Environment Variables, all environments)

| Name | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → `service_role` key (secret!) |
| `FORUM_SESSION_SECRET` | the generated 64-hex-char secret |
| `FORUM_ADMIN_KICK_IDS` | your numeric Kick user id(s), comma-separated. Shown by `/api/kick/debug` while signed in, or in the `profiles` table after first login |

(`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` already exist.)

## 2. Local dev — `.env.local` needs the same 3 vars plus the two `NEXT_PUBLIC_SUPABASE_*` values.

## 3. Database — open Supabase dashboard → SQL Editor → paste and run
`supabase/migrations/0001_forum.sql` (whole file, idempotent). This creates all
forum tables, views, functions, RLS, the seed flairs and the `forum-media` bucket.

## 4. GitHub Pages mirror — no action: the workflow already passes the Supabase
public vars; the forum is read-only there by design (no OAuth/API routes).
```

- [ ] **Step 4: Ask the user to fill anything missing**

Needed in `.env.local` to verify locally: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FORUM_SESSION_SECRET` (Step 2 value is fine), `FORUM_ADMIN_KICK_IDS`, plus existing `NEXT_PUBLIC_KICK_CLIENT_ID`/`KICK_CLIENT_SECRET` if Kick login will be tested locally. Pause here if the user must paste values; continue with Task 2 (file-only) while waiting if so.

- [ ] **Step 5: Commit**

```bash
git add docs/forum-setup.md
git commit -m "Forum: setup doc for env vars + migration"
```

---

### Task 2: Database migration (whole forum schema) (USER CHECKPOINT at the end)

**Files:**
- Create: `supabase/migrations/0001_forum.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_forum.sql` with exactly:

```sql
-- Community forum schema — idempotent; safe to re-run.
-- Posture: RLS on everything; anon/authenticated read ONLY via the views +
-- get_feed(); ALL writes happen through the service role (API routes), which
-- also calls the two SECURITY DEFINER write functions.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  kick_id       bigint unique not null,
  username      text not null,
  avatar_url    text,
  role          text not null default 'user' check (role in ('user','moderator','admin')),
  post_karma    int not null default 0,
  comment_karma int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.flairs (
  id         serial primary key,
  name       text unique not null,
  color      text not null default '#f59e0b',
  position   int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles(id),
  flair_id       int not null references public.flairs(id),
  title          text not null check (char_length(title) between 1 and 300),
  body           text,
  kind           text not null default 'text' check (kind in ('text','image','video','embed')),
  score          int not null default 0,
  comment_count  int not null default 0,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  removed_at     timestamptz,
  removed_by     uuid references public.profiles(id),
  removal_reason text
);

create table if not exists public.media_attachments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  kind         text not null check (kind in ('image','video','kick_clip','twitch_clip')),
  storage_path text,
  url          text,
  embed_id     text,
  width        int,
  height       int,
  duration_s   numeric,
  size_bytes   bigint,
  content_type text,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.comments (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.posts(id),
  parent_id      uuid references public.comments(id),
  author_id      uuid not null references public.profiles(id),
  body           text,
  gif_url        text,
  depth          int not null default 0 check (depth between 0 and 8),
  score          int not null default 0,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  removed_at     timestamptz,
  removed_by     uuid,
  removal_reason text,
  check (body is not null or gif_url is not null)
);

create table if not exists public.votes (
  profile_id   uuid not null references public.profiles(id),
  subject_type text not null check (subject_type in ('post','comment')),
  subject_id   uuid not null,
  value        smallint not null check (value in (-1, 1)),
  created_at   timestamptz not null default now(),
  primary key (profile_id, subject_type, subject_id)
);

create table if not exists public.bans (
  id         serial primary key,
  profile_id uuid not null references public.profiles(id),
  issued_by  uuid not null references public.profiles(id),
  reason     text,
  expires_at timestamptz,           -- null = permanent
  created_at timestamptz not null default now(),
  lifted_at  timestamptz,
  lifted_by  uuid references public.profiles(id)
);

create table if not exists public.mod_log (
  id           bigserial primary key,
  actor_id     uuid not null,
  action       text not null,
  subject_type text,
  subject_id   text,
  detail       jsonb,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes
create index if not exists posts_created_idx    on public.posts (created_at desc);
create index if not exists posts_flair_idx      on public.posts (flair_id, created_at desc);
create index if not exists comments_post_idx    on public.comments (post_id, parent_id);
create index if not exists votes_subject_idx    on public.votes (subject_type, subject_id);
create index if not exists bans_active_idx      on public.bans (profile_id) where lifted_at is null;

-- ---------------------------------------------------------------- RLS
alter table public.profiles          enable row level security;
alter table public.flairs            enable row level security;
alter table public.posts             enable row level security;
alter table public.media_attachments enable row level security;
alter table public.comments          enable row level security;
alter table public.votes             enable row level security;
alter table public.bans              enable row level security;
alter table public.mod_log           enable row level security;

-- flairs are harmless public data: direct read allowed
drop policy if exists "flairs readable" on public.flairs;
create policy "flairs readable" on public.flairs for select using (true);
-- everything else: NO policies → anon/authenticated denied; service role bypasses.

-- ---------------------------------------------------------------- read views
-- Owned by postgres (bypasses RLS by design); they ARE the public read API.
create or replace view public.profiles_public as
  select id, kick_id, username, avatar_url, role, post_karma, comment_karma, created_at
  from public.profiles;

create or replace view public.posts_feed as
  select
    p.id, p.title, p.body, p.kind, p.score, p.comment_count,
    p.created_at, p.edited_at,
    p.flair_id, f.name as flair_name, f.color as flair_color,
    pr.username as author_username, pr.avatar_url as author_avatar,
    pr.role as author_role, pr.kick_id as author_kick_id,
    (log(greatest(abs(p.score), 1)::numeric)
      + sign(p.score::numeric)
        * extract(epoch from (p.created_at - timestamptz '2026-01-01 00:00:00+00')) / 45000.0
    )::double precision as hot_score,
    (select coalesce(
        jsonb_agg(jsonb_build_object(
          'kind', m.kind, 'url', m.url, 'storage_path', m.storage_path,
          'embed_id', m.embed_id, 'width', m.width, 'height', m.height,
          'position', m.position) order by m.position),
        '[]'::jsonb)
       from public.media_attachments m where m.post_id = p.id) as attachments
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  join public.flairs f on f.id = p.flair_id
  where p.removed_at is null;

create or replace view public.comments_thread as
  select
    c.id, c.post_id, c.parent_id, c.depth, c.score, c.created_at, c.edited_at,
    (c.removed_at is not null) as removed,
    case when c.removed_at is null then c.body end as body,
    case when c.removed_at is null then c.gif_url end as gif_url,
    case when c.removed_at is null then pr.username end as author_username,
    case when c.removed_at is null then pr.avatar_url end as author_avatar,
    case when c.removed_at is null then pr.role end as author_role
  from public.comments c
  join public.profiles pr on pr.id = c.author_id;

grant select on public.profiles_public, public.posts_feed, public.comments_thread
  to anon, authenticated;

-- ---------------------------------------------------------------- feed RPC
create or replace function public.get_feed(
  p_sort   text default 'hot',
  p_flair  int default null,
  p_cursor jsonb default null,
  p_limit  int default 25
) returns setof public.posts_feed
language sql stable
as $$
  select *
  from public.posts_feed
  where (p_flair is null or flair_id = p_flair)
    and (
      p_cursor is null
      or case p_sort
           when 'new' then (created_at, id) < ((p_cursor->>'k')::timestamptz, (p_cursor->>'id')::uuid)
           when 'top' then (score, id)      < ((p_cursor->>'k')::int,        (p_cursor->>'id')::uuid)
           else            (hot_score, id)  < ((p_cursor->>'k')::double precision, (p_cursor->>'id')::uuid)
         end
    )
  order by
    case p_sort
      when 'new' then extract(epoch from created_at)
      when 'top' then score::double precision
      else hot_score
    end desc,
    id desc
  limit least(greatest(p_limit, 1), 50)
$$;

grant execute on function public.get_feed(text, int, jsonb, int) to anon, authenticated;

-- ------------------------------------------------- write RPCs (service only)
create or replace function public.cast_vote(
  p_profile uuid, p_type text, p_id uuid, p_value smallint
) returns table (new_score int, my_vote smallint)
language plpgsql security definer set search_path = public
as $$
declare
  v_old    smallint := 0;
  v_delta  int;
  v_author uuid;
begin
  if p_type not in ('post','comment') then raise exception 'bad_subject'; end if;
  if p_value not in (-1, 0, 1) then raise exception 'bad_value'; end if;

  select value into v_old from votes
    where profile_id = p_profile and subject_type = p_type and subject_id = p_id;
  v_old := coalesce(v_old, 0);

  if p_value = 0 then
    delete from votes
      where profile_id = p_profile and subject_type = p_type and subject_id = p_id;
  else
    insert into votes (profile_id, subject_type, subject_id, value)
    values (p_profile, p_type, p_id, p_value)
    on conflict (profile_id, subject_type, subject_id)
      do update set value = excluded.value;
  end if;

  v_delta := p_value - v_old;

  if p_type = 'post' then
    update posts set score = score + v_delta where id = p_id
      returning author_id, score into v_author, new_score;
    if v_author is null then raise exception 'not_found'; end if;
    update profiles set post_karma = post_karma + v_delta where id = v_author;
  else
    update comments set score = score + v_delta where id = p_id
      returning author_id, score into v_author, new_score;
    if v_author is null then raise exception 'not_found'; end if;
    update profiles set comment_karma = comment_karma + v_delta where id = v_author;
  end if;

  my_vote := p_value;
  return next;
end $$;

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

revoke execute on function public.cast_vote(uuid, text, uuid, smallint)
  from public, anon, authenticated;
revoke execute on function public.create_comment(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------- seeds
insert into public.flairs (name, color, position) values
  ('General Discussion',      '#f59e0b', 0),
  ('RV Life',                 '#34d399', 1),
  ('Stream Discussion',       '#60a5fa', 2),
  ('Suggestions & Feedback',  '#a78bfa', 3),
  ('Clips & Media',           '#f472b6', 4),
  ('Off Topic',               '#94a3b8', 5),
  ('Announcements',           '#ef4444', 6)
on conflict (name) do nothing;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('forum-media', 'forum-media', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0001_forum.sql
git commit -m "Forum: full schema migration (tables, RLS, views, RPCs, seeds, bucket)"
```

- [ ] **Step 3: USER CHECKPOINT — run the migration**

Ask the user to paste `supabase/migrations/0001_forum.sql` into Supabase dashboard → SQL Editor → Run, and confirm "Success. No rows returned". Verify afterwards (any of): user screenshot, or once `.env.local` is filled run:

```bash
node -e "const{createClient}=require('@supabase/supabase-js');require('next/dist/compiled/dotenv').config({path:'.env.local'});const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);c.from('flairs').select('id,name').then(r=>console.log(JSON.stringify(r.data)))"
```

Expected: JSON array with the 7 seeded flairs. Also confirm anon lockdown: same one-liner with `.from('posts').select('id')` must return an empty data array or a permission error — **not** rows.

---

### Task 3: `forumSession` lib (TDD) + vitest infra

**Files:**
- Create: `src/lib/forumSession.ts`
- Test: `src/lib/__tests__/forumSession.test.ts`
- Modify: `package.json` (devDep + test script)

- [ ] **Step 1: Install vitest and add the script**

Run: `npm install -D vitest`
Then in `package.json` scripts add: `"test": "vitest run"` (leave existing scripts untouched).

- [ ] **Step 2: Write the failing tests**

Create `src/lib/__tests__/forumSession.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FORUM_SESSION_MAX_AGE,
  signForumSession,
  verifyForumSession,
} from "../forumSession";

const SECRET = "test-secret";
const USER = { kickId: 123456, username: "chickenandy", avatar: null };

describe("forumSession", () => {
  it("round-trips a valid session", () => {
    const token = signForumSession(USER, SECRET);
    const s = verifyForumSession(token, SECRET);
    expect(s?.kickId).toBe(123456);
    expect(s?.username).toBe("chickenandy");
    expect(s?.avatar).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signForumSession(USER, SECRET);
    const [body, mac] = token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const forged = Buffer.from(JSON.stringify({ ...payload, kickId: 999 })).toString("base64url");
    expect(verifyForumSession(`${forged}.${mac}`, SECRET)).toBeNull();
  });

  it("rejects the wrong secret", () => {
    expect(verifyForumSession(signForumSession(USER, "other-secret"), SECRET)).toBeNull();
  });

  it("rejects an expired session", () => {
    const past = Date.now() - (FORUM_SESSION_MAX_AGE + 60) * 1000;
    const token = signForumSession(USER, SECRET, past);
    expect(verifyForumSession(token, SECRET)).toBeNull();
  });

  it("rejects garbage tokens", () => {
    expect(verifyForumSession(undefined, SECRET)).toBeNull();
    expect(verifyForumSession("", SECRET)).toBeNull();
    expect(verifyForumSession("not-a-token", SECRET)).toBeNull();
    expect(verifyForumSession("a.b", SECRET)).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL (module missing)**

Run: `npx vitest run src/lib/__tests__/forumSession.test.ts`
Expected: FAIL — cannot resolve `../forumSession`.

- [ ] **Step 4: Implement**

Create `src/lib/forumSession.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/* Signed forum session — proves the caller's Kick identity to the forum write
   routes without a per-request Kick API call or a DB session table.
   Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(body)).
   Minted by the Kick OAuth callback, cleared by logout. The cookie only
   carries identity — role and ban status are loaded from the DB per write. */

export const FORUM_SESSION_COOKIE = "forum_session";
export const FORUM_SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 days, matches kick_refresh

export type ForumSession = {
  kickId: number;
  username: string;
  avatar: string | null;
  iat: number; // seconds since epoch
  exp: number;
};

function hmac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

export function signForumSession(
  user: { kickId: number; username: string; avatar: string | null },
  secret: string,
  nowMs = Date.now(),
): string {
  const iat = Math.floor(nowMs / 1000);
  const payload: ForumSession = { ...user, iat, exp: iat + FORUM_SESSION_MAX_AGE };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret).toString("base64url")}`;
}

export function verifyForumSession(
  token: string | undefined,
  secret: string,
  nowMs = Date.now(),
): ForumSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = hmac(body, secret);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  let payload: ForumSession;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload?.kickId !== "number" || typeof payload?.exp !== "number") return null;
  if (typeof payload.username !== "string") return null;
  if (payload.exp <= Math.floor(nowMs / 1000)) return null;
  return payload;
}
```

- [ ] **Step 5: Run tests — expect PASS (5/5)**

Run: `npx vitest run src/lib/__tests__/forumSession.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/forumSession.ts src/lib/__tests__/forumSession.test.ts package.json package-lock.json
git commit -m "Forum: HMAC-signed forum_session lib + vitest infra"
```

---

### Task 4: Server Supabase admin client

**Files:**
- Create: `src/lib/supabaseAdmin.ts`

- [ ] **Step 1: Implement**

Create `src/lib/supabaseAdmin.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Service-role Supabase client — SERVER ONLY (API routes / OAuth callback).
   Bypasses RLS; never import from client components. Degrades to null when
   env is missing so builds and the static export never break. */

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!admin) {
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/lib/supabaseAdmin.ts
git commit -m "Forum: service-role Supabase client (server only)"
```

---

### Task 5: OAuth callback extension + logout cleanup

**Files:**
- Modify: `src/app/api/auth/kick/callback/route.ts`
- Modify: `src/app/api/auth/kick/logout/route.ts`

- [ ] **Step 1: Extend the callback**

In `src/app/api/auth/kick/callback/route.ts`:

(a) Add imports after the existing `next/server` import:

```ts
import { FORUM_SESSION_COOKIE, FORUM_SESSION_MAX_AGE, signForumSession } from "@/lib/forumSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
```

(b) Replace the user-fetch block

```ts
  // best-effort: fetch the signed-in user's display name
  let username = "Kick user";
  try {
    const ur = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (ur.ok) {
      const uj = await ur.json();
      username = uj?.data?.[0]?.name || uj?.data?.[0]?.username || username;
    }
  } catch {
    /* keep default */
  }
```

with:

```ts
  // best-effort: fetch the signed-in user's identity. The numeric user_id is
  // the stable anchor the forum profile hangs off (usernames can change).
  let username = "Kick user";
  let kickId: number | null = null;
  let avatar: string | null = null;
  try {
    const ur = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (ur.ok) {
      const uj = await ur.json();
      const u = uj?.data?.[0] ?? {};
      username = u.name || u.username || username;
      const rawId = Number(u.user_id);
      kickId = Number.isFinite(rawId) && rawId > 0 ? rawId : null;
      avatar = typeof u.profile_picture === "string" && u.profile_picture ? u.profile_picture : null;
    }
  } catch {
    /* keep defaults */
  }
```

(c) Immediately before the final `res.cookies.delete("kick_pkce");` line, insert:

```ts
  // Forum identity: signed session cookie + profile upsert (spec:
  // docs/superpowers/specs/2026-07-05-community-forum-design.md §4.1).
  const forumSecret = process.env.FORUM_SESSION_SECRET ?? "";
  if (kickId && forumSecret) {
    res.cookies.set(FORUM_SESSION_COOKIE, signForumSession({ kickId, username, avatar }, forumSecret), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: FORUM_SESSION_MAX_AGE,
    });
    try {
      const admin = getSupabaseAdmin();
      if (admin) {
        const adminIds = (process.env.FORUM_ADMIN_KICK_IDS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const { data: existing } = await admin
          .from("profiles")
          .select("role")
          .eq("kick_id", kickId)
          .maybeSingle();
        // allowlist promotes to admin; otherwise keep whatever role the row has
        const role = adminIds.includes(String(kickId)) ? "admin" : existing?.role ?? "user";
        await admin
          .from("profiles")
          .upsert({ kick_id: kickId, username, avatar_url: avatar, role }, { onConflict: "kick_id" });
      }
    } catch {
      /* profile syncs on a later login — never block sign-in on the forum DB */
    }
  }
```

- [ ] **Step 2: Clear the cookie on logout**

In `src/app/api/auth/kick/logout/route.ts`, after `res.cookies.delete("kick_user");` add:

```ts
  res.cookies.delete("forum_session");
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → clean.

- [ ] **Step 4: Verify with a real login (needs `.env.local` + migration done)**

Run `npm run dev`, open `http://localhost:3000/login`, sign in with Kick, then:
1. DevTools → Application → Cookies: `forum_session` present (httpOnly).
2. Supabase dashboard → Table Editor → `profiles`: one row with your `kick_id`, current username/avatar; `role` = `admin` if your id is in `FORUM_ADMIN_KICK_IDS`.
If env isn't wired yet, mark this pending and note it for the final task's verification pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/kick/callback/route.ts src/app/api/auth/kick/logout/route.ts
git commit -m "Forum: mint forum_session + upsert profile at Kick login; clear on logout"
```

---

### Task 6: Forum API helpers + `GET /api/forum/me`

**Files:**
- Create: `src/lib/forumApi.ts`
- Create: `src/app/api/forum/me/route.ts`

- [ ] **Step 1: Implement the shared route helpers**

Create `src/lib/forumApi.ts`:

```ts
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
```

- [ ] **Step 2: Implement `/api/forum/me`**

Create `src/app/api/forum/me/route.ts`:

```ts
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
```

- [ ] **Step 3: Typecheck + verify**

Run: `npx tsc --noEmit` → clean.
With the dev server running: `curl -s http://localhost:3000/api/forum/me` → `{"signedOut":true}` when not signed in; after a browser Kick login, the browser request to `/api/forum/me` returns the profile JSON (check via DevTools network tab or `document.cookie`-bearing fetch from the console).

- [ ] **Step 4: Commit**

```bash
git add src/lib/forumApi.ts src/app/api/forum/me/route.ts
git commit -m "Forum: route auth helpers + /api/forum/me"
```

---

### Task 7: Client data layer `src/lib/forum.ts` (TDD for the pure parts)

**Files:**
- Create: `src/lib/forum.ts`
- Test: `src/lib/__tests__/forum.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/forum.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextCursor, timeAgo, type FeedPost } from "../forum";

const post = (over: Partial<FeedPost>): FeedPost => ({
  id: "00000000-0000-0000-0000-000000000001",
  title: "t",
  body: null,
  kind: "text",
  score: 5,
  comment_count: 0,
  created_at: "2026-07-01T00:00:00.000Z",
  edited_at: null,
  flair_id: 1,
  flair_name: "General Discussion",
  flair_color: "#f59e0b",
  author_username: "andy",
  author_avatar: null,
  author_role: "user",
  author_kick_id: 1,
  hot_score: 1.23,
  attachments: [],
  ...over,
});

describe("nextCursor", () => {
  it("returns null for an empty page", () => {
    expect(nextCursor("hot", [])).toBeNull();
  });
  it("uses created_at for new, score for top, hot_score for hot", () => {
    const page = [post({}), post({ id: "00000000-0000-0000-0000-000000000002" })];
    expect(nextCursor("new", page)).toEqual({
      k: "2026-07-01T00:00:00.000Z",
      id: "00000000-0000-0000-0000-000000000002",
    });
    expect(nextCursor("top", page)).toEqual({ k: 5, id: "00000000-0000-0000-0000-000000000002" });
    expect(nextCursor("hot", page)).toEqual({ k: 1.23, id: "00000000-0000-0000-0000-000000000002" });
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-07-05T12:00:00.000Z");
  it("formats compact reddit-style ages", () => {
    expect(timeAgo("2026-07-05T11:59:30.000Z", now)).toBe("30s");
    expect(timeAgo("2026-07-05T11:15:00.000Z", now)).toBe("45m");
    expect(timeAgo("2026-07-05T03:00:00.000Z", now)).toBe("9h");
    expect(timeAgo("2026-07-01T12:00:00.000Z", now)).toBe("4d");
    expect(timeAgo("2026-05-01T12:00:00.000Z", now)).toBe("2mo");
    expect(timeAgo("2024-07-05T12:00:00.000Z", now)).toBe("2y");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `npx vitest run src/lib/__tests__/forum.test.ts`

- [ ] **Step 3: Implement**

Create `src/lib/forum.ts`:

```ts
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
```

- [ ] **Step 4: Run all tests — expect PASS**

Run: `npm test` → forumSession (5) + forum (3) all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forum.ts src/lib/__tests__/forum.test.ts
git commit -m "Forum: client data layer (feed RPC, flairs, post, cursors, timeAgo)"
```

---

### Task 8: `POST /api/forum/posts` (text posts)

**Files:**
- Create: `src/app/api/forum/posts/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/forum/posts/route.ts`:

```ts
import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 300;
const MAX_BODY = 10_000;

/* v1: text posts. Media attachments + clip embeds land in plan 03, which
   extends this handler — keep the shape { title, flair_id, body }. */

export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { title?: unknown; flair_id?: unknown; body?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const flairId = Number(raw.flair_id);

  if (!title || title.length > MAX_TITLE) {
    return jsonError(400, "bad_title", `Title must be 1-${MAX_TITLE} characters.`);
  }
  if (body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Body is limited to ${MAX_BODY} characters.`);
  }
  if (!Number.isInteger(flairId) || flairId <= 0) {
    return jsonError(400, "bad_flair", "Pick a flair.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data: flair } = await admin.from("flairs").select("id").eq("id", flairId).maybeSingle();
  if (!flair) return jsonError(400, "bad_flair", "That flair doesn't exist.");

  const { data, error } = await admin
    .from("posts")
    .insert({
      author_id: caller.profile.id,
      flair_id: flairId,
      title,
      body: body || null,
      kind: "text",
    })
    .select("id")
    .single();
  if (error) return jsonError(500, "db_error", error.message);

  return Response.json({ id: data.id });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/app/api/forum/posts/route.ts
git commit -m "Forum: POST /api/forum/posts (text posts, validated, ban-gated)"
```

---

### Task 9: Feed UI — `FlairBar`, `PostCard`, `ForumFeed`, `/community` page

**Files:**
- Create: `src/components/forum/FlairBar.tsx`
- Create: `src/components/forum/PostCard.tsx`
- Create: `src/components/forum/ForumFeed.tsx`
- Modify: `src/app/community/page.tsx` (full rewrite)

- [ ] **Step 1: `FlairBar`**

Create `src/components/forum/FlairBar.tsx`:

```tsx
"use client";

import { type Flair } from "@/lib/forum";

export default function FlairBar({
  flairs,
  active,
  onPick,
}: {
  flairs: Flair[];
  active: number | null;
  onPick: (id: number | null) => void;
}) {
  if (!flairs.length) return null;
  const chip = (selected: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors ${
      selected
        ? "border-accent bg-accent/15 text-accent"
        : "border-line text-neutral-300 hover:border-neutral-500"
    }`;
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip(active == null)} onClick={() => onPick(null)}>
        All
      </button>
      {flairs.map((f) => (
        <button
          key={f.id}
          type="button"
          className={chip(active === f.id)}
          onClick={() => onPick(active === f.id ? null : f.id)}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `PostCard`**

Create `src/components/forum/PostCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { type FeedPost, timeAgo } from "@/lib/forum";

export function FlairChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {name}
    </span>
  );
}

/** One feed/detail card. `full` = detail page (no clamp, title not a link).
    The static score rail becomes the interactive VoteRail in plan 02. */
export default function PostCard({ post, full = false }: { post: FeedPost; full?: boolean }) {
  const href = `/community/post?id=${post.id}`;
  const title = (
    <h2 className={`font-bold leading-snug text-neutral-100 ${full ? "text-xl" : "text-base"}`}>
      {post.title}
    </h2>
  );
  return (
    <article className="flex gap-3 rounded-xl border border-line bg-panel p-3 transition-colors hover:border-neutral-600">
      <div className="flex w-10 shrink-0 flex-col items-center gap-1 pt-1 text-neutral-400">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5l7 8h-4v6h-6v-6H5z" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-bold text-neutral-200">{post.score}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 rotate-180" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5l7 8h-4v6h-6v-6H5z" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <FlairChip name={post.flair_name} color={post.flair_color} />
          <span className="font-semibold text-neutral-300">u/{post.author_username}</span>
          <span>·</span>
          <span>{timeAgo(post.created_at)} ago</span>
          {post.edited_at && <span className="italic">(edited)</span>}
        </div>
        {full ? (
          <div className="mt-1.5">{title}</div>
        ) : (
          <Link href={href} className="mt-1.5 block">
            {title}
          </Link>
        )}
        {post.body && (
          <p
            className={`mt-1.5 whitespace-pre-wrap text-sm text-neutral-400 ${full ? "" : "line-clamp-3"}`}
          >
            {post.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-neutral-500">
          <Link href={href} className="flex items-center gap-1.5 transition-colors hover:text-neutral-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M21 12a8 8 0 01-8 8H4l2-3a8 8 0 1115-5z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {post.comment_count} comments
          </Link>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: `ForumFeed`**

Create `src/components/forum/ForumFeed.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FEED_PAGE,
  fetchFeed,
  fetchFlairs,
  nextCursor,
  type FeedCursor,
  type FeedPost,
  type FeedSort,
  type Flair,
} from "@/lib/forum";
import FlairBar from "@/components/forum/FlairBar";
import PostCard from "@/components/forum/PostCard";

const SORTS: FeedSort[] = ["hot", "new", "top"];
const SORT_LABEL: Record<FeedSort, string> = { hot: "Hot", new: "New", top: "Top" };

export default function ForumFeed() {
  const router = useRouter();
  const params = useSearchParams();
  const rawSort = params.get("sort") as FeedSort | null;
  const sort: FeedSort = rawSort && SORTS.includes(rawSort) ? rawSort : "hot";
  const flairParam = params.get("flair");
  const flair = flairParam ? Number(flairParam) || null : null;

  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [posts, setPosts] = useState<FeedPost[] | null>(null); // null = first load
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const cursor = useRef<FeedCursor>(null);
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const setQuery = (nextSort: FeedSort, nextFlair: number | null) => {
    const q = new URLSearchParams();
    if (nextSort !== "hot") q.set("sort", nextSort);
    if (nextFlair != null) q.set("flair", String(nextFlair));
    router.replace(`/community${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const loadMore = useCallback(
    async (reset: boolean) => {
      if (loading.current) return;
      loading.current = true;
      setError(null);
      try {
        const page = await fetchFeed(sort, flair, reset ? null : cursor.current);
        cursor.current = nextCursor(sort, page);
        setPosts((prev) => (reset || !prev ? page : [...prev, ...page]));
        if (page.length < FEED_PAGE) setDone(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        loading.current = false;
      }
    },
    [sort, flair],
  );

  useEffect(() => {
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);

  useEffect(() => {
    cursor.current = null;
    setPosts(null);
    setDone(false);
    loadMore(true);
  }, [loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore(false);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done, posts?.length]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-line p-0.5">
          {SORTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuery(s, flair)}
              className={`rounded-full px-3.5 py-1 text-sm font-semibold transition-colors ${
                s === sort ? "bg-accent text-accent-ink" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {SORT_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <FlairBar flairs={flairs} active={flair} onPick={(id) => setQuery(sort, id)} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {posts === null &&
          !error &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-panel" />
          ))}

        {error && (
          <div className="rounded-xl border border-line bg-panel p-6 text-center">
            <p className="text-sm text-neutral-400">Couldn&apos;t load the feed: {error}</p>
            <button
              type="button"
              onClick={() => loadMore(posts === null)}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
            >
              Try again
            </button>
          </div>
        )}

        {posts?.map((p) => <PostCard key={p.id} post={p} />)}

        {posts !== null && posts.length === 0 && !error && (
          <div className="rounded-xl border border-line bg-panel p-10 text-center text-neutral-500">
            No posts {flair != null ? "with this flair " : ""}yet — be the first!
          </div>
        )}

        {done && posts !== null && posts.length > 0 && (
          <p className="py-4 text-center text-xs text-neutral-600">You&apos;re all caught up.</p>
        )}
        <div ref={sentinel} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `/community` page**

Replace the whole contents of `src/app/community/page.tsx` with:

```tsx
import { Suspense } from "react";
import Link from "next/link";
import ForumFeed from "@/components/forum/ForumFeed";

export const metadata = { title: "Community — ChickenAndy" };

export default function CommunityPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Community</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Talk RV life, streams, clips and everything ChickenAndy.
            </p>
          </div>
          <Link
            href="/community/submit"
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft active:scale-95"
          >
            Create post
          </Link>
        </div>
        <div className="mt-5">
          <Suspense fallback={null}>
            <ForumFeed />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify in the browser**

`npm run dev` → `http://localhost:3000/community`:
1. Sort pill row + flair chips render (7 flairs from the DB — requires migration done).
2. Empty state card shows ("No posts yet — be the first!").
3. Switching sorts/flairs updates the URL (`?sort=new`, `?flair=3`) without full reload.
4. No console errors.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `npx tsc --noEmit && npm run lint` → clean.

```bash
git add src/components/forum/FlairBar.tsx src/components/forum/PostCard.tsx src/components/forum/ForumFeed.tsx src/app/community/page.tsx
git commit -m "Forum: live feed at /community (hot/new/top, flair filter, infinite scroll)"
```

---

### Task 10: Submit page

**Files:**
- Create: `src/components/forum/SubmitForm.tsx`
- Create: `src/app/community/submit/page.tsx`

- [ ] **Step 1: `SubmitForm`**

Create `src/components/forum/SubmitForm.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { appOrigin, fetchFlairs, fetchMe, timeAgo, type Flair, type Me } from "@/lib/forum";
import { startKickLogin, kickLoginConfigured } from "@/lib/kickAuth";
import { FlairChip } from "@/components/forum/PostCard";

const MAX_TITLE = 300;
const MAX_BODY = 10_000;

export default function SubmitForm() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [flairId, setFlairId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().then(setMe);
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);

  const canPost = title.trim().length > 0 && flairId != null && !busy;

  async function submit() {
    if (!canPost) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), flair_id: flairId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Posting failed (${r.status}).`);
      router.push(`/community/post?id=${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (me === null) {
    return <div className="h-48 animate-pulse rounded-xl border border-line bg-panel" />;
  }

  if ("signedOut" in me) {
    const origin = appOrigin();
    return (
      <div className="rounded-xl border border-line bg-panel p-8 text-center">
        <h2 className="text-lg font-bold">Sign in to post</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">
          Posting, voting and commenting use your Kick account.
        </p>
        {origin ? (
          <a
            href={`${origin}/community/submit`}
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
          >
            Sign in on chickenwebsite.vercel.app
          </a>
        ) : kickLoginConfigured() ? (
          <button
            type="button"
            onClick={() => startKickLogin()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
          >
            Sign in with Kick
          </button>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">Kick login isn&apos;t configured here.</p>
        )}
      </div>
    );
  }

  if (me.ban) {
    return (
      <div className="rounded-xl border border-mature/40 bg-mature/10 p-6">
        <h2 className="font-bold text-neutral-100">You&apos;re banned from the forum</h2>
        <p className="mt-1 text-sm text-neutral-400">
          {me.ban.reason || "No reason given."}{" "}
          {me.ban.expires_at
            ? `Ban lifts in ${timeAgo(me.ban.expires_at, Date.now() - 2 * (Date.now() - new Date(me.ban.expires_at).getTime()))}.`
            : "This ban is permanent."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Flair <span className="text-accent">*</span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {flairs.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFlairId(flairId === f.id ? null : f.id)}
            className={`rounded-full transition ${flairId === f.id ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100"}`}
          >
            <FlairChip name={f.name} color={f.color} />
          </button>
        ))}
      </div>

      <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Title <span className="text-accent">*</span>
      </label>
      <input
        value={title}
        maxLength={MAX_TITLE}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="An interesting title"
        className="mt-2 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
      />
      <p className="mt-1 text-right text-[11px] text-neutral-600">
        {title.length}/{MAX_TITLE}
      </p>

      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Body <span className="text-neutral-600">(optional)</span>
      </label>
      <textarea
        value={body}
        maxLength={MAX_BODY}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="Text (optional)"
        className="mt-2 w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
      />

      {error && <p className="mt-3 text-sm text-mature">{error}</p>}

      <div className="mt-4 flex items-center justify-end gap-3">
        <Link href="/community" className="text-sm font-semibold text-neutral-400 hover:text-neutral-200">
          Cancel
        </Link>
        <button
          type="button"
          disabled={!canPost}
          onClick={submit}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Submit page shell**

Create `src/app/community/submit/page.tsx`:

```tsx
import Link from "next/link";
import SubmitForm from "@/components/forum/SubmitForm";

export const metadata = { title: "Create post — ChickenAndy" };

export default function SubmitPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/community" className="text-sm font-semibold text-neutral-400 hover:text-neutral-200">
          ← Community
        </Link>
        <h1 className="mt-3 text-2xl font-black">Create a post</h1>
        <div className="mt-5">
          <SubmitForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify end-to-end (needs env + migration + Kick login)**

Dev server → sign in with Kick → `/community/submit`:
1. Signed out: sign-in card. Signed in: form.
2. Post button disabled until title + flair set.
3. Create a post → redirected to `/community/post?id=…` (404-ish empty view until Task 11 — the redirect itself is the check).
4. `/community` now shows the post; flair filter narrows to it; New sort shows it first.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/forum/SubmitForm.tsx src/app/community/submit/page.tsx
git commit -m "Forum: submit page (flair picker, title/body, ban + signed-out states)"
```

---

### Task 11: Post detail page

**Files:**
- Create: `src/components/forum/PostView.tsx`
- Create: `src/app/community/post/page.tsx`

- [ ] **Step 1: `PostView`**

Create `src/components/forum/PostView.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchPost, type FeedPost } from "@/lib/forum";
import PostCard from "@/components/forum/PostCard";

export default function PostView() {
  const id = useSearchParams().get("id");
  const [post, setPost] = useState<FeedPost | null | "missing">(null);

  useEffect(() => {
    if (!id) {
      setPost("missing");
      return;
    }
    fetchPost(id)
      .then((p) => setPost(p ?? "missing"))
      .catch(() => setPost("missing"));
  }, [id]);

  if (post === null) {
    return <div className="h-48 animate-pulse rounded-xl border border-line bg-panel" />;
  }

  if (post === "missing") {
    return (
      <div className="rounded-xl border border-line bg-panel p-10 text-center">
        <p className="font-bold text-neutral-200">This post doesn&apos;t exist (or was removed).</p>
        <Link
          href="/community"
          className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
        >
          Back to the community feed
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PostCard post={post} full />
      {/* Threaded comments arrive in plan 02 (comments + votes). */}
      <div className="mt-4 rounded-xl border border-line bg-panel p-8 text-center text-sm text-neutral-500">
        Comments are coming in the next update.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page shell**

Create `src/app/community/post/page.tsx`:

```tsx
import { Suspense } from "react";
import Link from "next/link";
import PostView from "@/components/forum/PostView";

export const metadata = { title: "Post — ChickenAndy Community" };

export default function PostPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/community" className="text-sm font-semibold text-neutral-400 hover:text-neutral-200">
          ← Community
        </Link>
        <div className="mt-3">
          <Suspense fallback={null}>
            <PostView />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Dev server: open a post from the feed → full title, full body (no clamp), flair chip, author, "Comments are coming" card. Bad id (`/community/post?id=00000000-0000-0000-0000-000000000000`) → missing card with back link.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/forum/PostView.tsx src/app/community/post/page.tsx
git commit -m "Forum: post detail page (query-param route, static-export safe)"
```

---

### Task 12: Pages-mirror env + both build modes green

**Files:**
- Modify: `.github/workflows/pages.yml`

- [ ] **Step 1: Add the app-origin env to the Pages build**

In `.github/workflows/pages.yml`, inside the `Build static export` step's `env:` block, after the `NEXT_PUBLIC_HLS_PROXY` line add:

```yaml
          # Forum writes need the Vercel app (OAuth + API routes). The static
          # mirror renders the forum read-only and deep-links sign-in/submit here.
          NEXT_PUBLIC_APP_ORIGIN: ${{ vars.APP_ORIGIN || 'https://chickenwebsite.vercel.app' }}
```

- [ ] **Step 2: Verify the normal build**

Run: `npm run build`
Expected: compiles; `/community`, `/community/submit`, `/community/post` present; `/api/forum/me` + `/api/forum/posts` listed as dynamic routes.

- [ ] **Step 3: Verify the static-export build (simulates the Pages workflow)**

```bash
cp -r src/app/api /tmp/forum-api-backup && rm -rf src/app/api
BUILD_TARGET=export PAGES_BASE_PATH=/ChickenWebsite npm run build
cp -r /tmp/forum-api-backup src/app/api && rm -rf /tmp/forum-api-backup
```

Expected: static export succeeds with the three community pages in `out/`. (On PowerShell use `Copy-Item`/`Remove-Item` equivalents, or run in Git Bash.) **Restore `src/app/api` even if the build fails.**

- [ ] **Step 4: Run the whole test suite once more**

Run: `npm test` → all green.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "Forum: read-only Pages mirror deep-links writes to the Vercel app"
```

---

### Task 13: Ship it (USER-VISIBLE MILESTONE)

- [ ] **Step 1: Full verification sweep (needs env + migration)**

With `npm run dev`:
1. Kick login → `profiles` row updated, `forum_session` cookie set.
2. `/community`: feed loads, sorts + flair filters work, URL params stick on reload.
3. Create a text post → lands on detail page → visible in feed.
4. Sign out → `/community` still readable; submit page shows the sign-in card; `POST /api/forum/posts` via curl without cookies → `401 {"code":"signed_out",…}`.
5. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.

- [ ] **Step 2: Push to deploy (Vercel + Pages auto-deploy from main)**

Confirm with the user that the Vercel env vars from Task 1 are saved (the prod callback needs `FORUM_SESSION_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` before login mints forum sessions there), then:

```bash
git push origin main
```

- [ ] **Step 3: Verify production**

- `https://chickenwebsite.vercel.app/community` → feed renders (empty or with the test post).
- `https://chickenwebsite.vercel.app/api/forum/me` → `{"signedOut":true}` when logged out (proves routes deployed).
- After the Pages action finishes: the mirror's `/community` renders the same feed read-only.

---

## Self-review notes (checked against the spec)

- **Coverage this plan:** spec §4.1 (identity/session) → Tasks 3-6; §5 + §5.1 + §5.2-bucket (full schema incl. later-phase tables/RPCs) → Task 2; §6 rows `me`/`posts`(create) → Tasks 6, 8; §7 feed/submit/post-detail/Pages-mirror → Tasks 9-12; §9 testing → Tasks 3, 7; §11 env → Tasks 1, 12. Deliberately deferred to plans 02-05 (per the phased spec §10): remaining §6 routes, comments/votes UI, media, GIFs, hovercards, moderation UI.
- **Type consistency:** `FeedPost` fields = `posts_feed` view columns 1:1 (incl. `hot_score`, `attachments` jsonb → `FeedAttachment[]`); `FORUM_SESSION_COOKIE`/`FORUM_SESSION_MAX_AGE` used in callback + logout + `forumApi`; `Me`/`MeProfile` match `/api/forum/me`'s response; `FlairChip` exported from `PostCard` and reused in `SubmitForm`.
- **No placeholders:** every code step is complete; the two later-phase seams are explicit ("VoteRail in plan 02", "comments in plan 02") with working stand-ins, not TODOs.

