# Community Forum — Design Spec

**Date:** 2026-07-05
**Status:** Approved (design review passed; pending spec sign-off)
**Feature:** Reddit-style community forum (media-rich, LSF-inspired) living in the `/community` tab, authenticated via the existing Kick OAuth flow.

## 1. Goals

- Users sign in with their Kick account (existing OAuth) and get a forum profile tied to their **stable numeric Kick user ID**.
- Text posts, direct photo uploads, direct video uploads, and Kick/Twitch clip links — all rendered seamlessly in one feed.
- Reddit-style custom video player (muted autoplay on scroll, custom controls) for uploaded videos; official iframes for clips.
- Flairs (admin-managed) with feed filtering; up/down votes with karma; threaded comments with Tenor GIFs.
- Kick profile hovercards on every username.
- Forum-native RBAC moderation (User / Moderator / Admin) fully independent of Kick channel moderation, with soft-removal and forum bans.

## 2. Context and constraints

- **Stack:** Next.js 16.2.10 App Router (`src/app`), React 19, Tailwind v4, TypeScript. Per `AGENTS.md`, consult `node_modules/next/dist/docs/` before writing code — this Next version has breaking changes.
- **Deploys:** Vercel (full app) + GitHub Pages static mirror (`BUILD_TARGET=export`; the workflow deletes `src/app/api` first). Forum API routes are therefore automatically absent from the mirror.
- **Existing auth:** Kick OAuth 2.1 + PKCE. `src/lib/kickAuth.ts` builds the redirect; `/api/auth/kick/callback` exchanges the code, sets `kick_token` (httpOnly, ~1h), `kick_refresh` (httpOnly, rotating, 60d), `kick_user` (readable display name). `KickSessionKeeper` renews silently. **Gap being fixed here:** the callback fetches `https://api.kick.com/public/v1/users` but discards `user_id` and `profile_picture`; the forum needs both.
- **Supabase** is already a dependency (`@supabase/supabase-js`, `src/lib/supabase.ts` browser client gated on `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **Vercel limit:** serverless request bodies cap at ~4.5MB → uploads must go browser → storage directly.
- **Supabase free tier:** 50MB per-file upload cap, 1GB total storage. Caps must be env-configurable.
- **Compliance stance (site-wide):** official embeds only, public keyless client-side Kick API reads (same as `src/lib/kick.ts`).

## 3. Decisions (from brainstorm Q&A)

| Decision | Choice |
|---|---|
| DB + media storage | **Supabase** (Postgres + Storage, one project) |
| GIF provider | **Tenor** (`TENOR_API_KEY`, server-side proxy) |
| Hovercard "Account Level" | **Kick fields only** — avatar, verified, followers, join date; no invented numbers (Kick's public API exposes no account level) |
| First admin | **Env allowlist** `FORUM_ADMIN_KICK_IDS` (comma-separated Kick user IDs → `admin` role at login upsert) |
| Architecture | **Hybrid (approach C):** client-direct anon reads under RLS; all writes via Vercel API routes with service-role key |
| Flair seeds | The 7 existing community-page chips: General Discussion, RV Life, Stream Discussion, Suggestions & Feedback, Clips & Media, Off Topic, Announcements |
| Votes | Reddit-style ±1 on posts and comments |

## 4. Architecture (approach C — hybrid)

- **Reads** (feed, post, thread, flairs, profiles): browser → Supabase with the **anon key**. RLS grants SELECT only, via masked read views and `SECURITY INVOKER` RPCs. Works identically on Vercel and the Pages mirror (mirror is read-only by construction: no API routes, no session cookies cross-origin).
- **Writes, uploads, moderation:** Next.js route handlers under `/api/forum/*` (Node runtime) verify the `forum_session` cookie, load the caller's DB row (role, ban), and write with `SUPABASE_SERVICE_ROLE_KEY`.
- **Atomicity:** votes/karma and counters change via Postgres functions (RPCs) — never read-modify-write from JS.

### 4.1 Identity and sessions

Callback route extension (`/api/auth/kick/callback`):

1. Keep `user_id` (numeric, stable) and `profile_picture` from the existing `/public/v1/users` call.
2. Upsert `profiles` on `kick_id` (service key): refresh `username`, `avatar_url` every login; set `role='admin'` when `kick_id ∈ FORUM_ADMIN_KICK_IDS` (never downgrade an existing admin/moderator otherwise).
3. Set **`forum_session`** cookie: `base64url(payload JSON) + "." + base64url(HMAC-SHA256(payload, FORUM_SESSION_SECRET))`, payload `{kick_id, username, avatar, iat, exp}`; httpOnly, secure, sameSite=lax, maxAge 60d (matches `kick_refresh`). Cleared by the logout route alongside the other cookies.
4. Verification helper `src/lib/forumSession.ts` (server-only): parse + constant-time HMAC check + expiry check.

Enforcement rule: **the cookie only authenticates identity; role and ban status are always loaded from the DB per write request.**

## 5. Database schema (one migration: `supabase/migrations/0001_forum.sql`)

```sql
profiles (
  id            uuid PK default gen_random_uuid(),
  kick_id       bigint UNIQUE NOT NULL,
  username      text NOT NULL,
  avatar_url    text,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  post_karma    int NOT NULL DEFAULT 0,
  comment_karma int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
)

flairs (
  id serial PK, name text UNIQUE NOT NULL, color text NOT NULL DEFAULT '#f59e0b',
  position int NOT NULL DEFAULT 0, created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
)

posts (
  id uuid PK, author_id uuid NOT NULL REFERENCES profiles(id),
  flair_id int NOT NULL REFERENCES flairs(id),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  body text,                       -- plain text w/ linebreaks in v1 (no markdown)
  kind text NOT NULL CHECK (kind IN ('text','image','video','embed')),
  score int NOT NULL DEFAULT 0, comment_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(), edited_at timestamptz,
  removed_at timestamptz, removed_by uuid REFERENCES profiles(id), removal_reason text
)

media_attachments (
  id uuid PK, post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','video','kick_clip','twitch_clip')),
  storage_path text,               -- uploads: '{kick_id}/{yyyy-mm}/{uuid}.{ext}'
  url text,                        -- clips: canonical clip URL
  embed_id text,                   -- clips: parsed clip/channel identifiers
  width int, height int, duration_s numeric, size_bytes bigint, content_type text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

comments (
  id uuid PK, post_id uuid NOT NULL REFERENCES posts(id),
  parent_id uuid REFERENCES comments(id),
  author_id uuid NOT NULL REFERENCES profiles(id),
  body text, gif_url text,         -- at least one required (CHECK)
  depth int NOT NULL DEFAULT 0,    -- server-enforced cap: 8
  score int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(), edited_at timestamptz,
  removed_at timestamptz, removed_by uuid, removal_reason text
)

votes (
  profile_id uuid REFERENCES profiles(id),
  subject_type text CHECK (subject_type IN ('post','comment')),
  subject_id uuid, value smallint NOT NULL CHECK (value IN (-1,1)),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (profile_id, subject_type, subject_id)
)

bans (
  id serial PK, profile_id uuid NOT NULL REFERENCES profiles(id),
  issued_by uuid NOT NULL REFERENCES profiles(id), reason text,
  expires_at timestamptz,          -- NULL = permanent
  created_at timestamptz DEFAULT now(),
  lifted_at timestamptz, lifted_by uuid REFERENCES profiles(id)
)
-- active ban: lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())

mod_log (
  id bigserial PK, actor_id uuid NOT NULL, action text NOT NULL,
  subject_type text, subject_id text, detail jsonb, created_at timestamptz DEFAULT now()
)
```

Indexes: `posts(created_at DESC)`, `posts(flair_id, created_at DESC)`, `comments(post_id, parent_id)`, `votes(subject_type, subject_id)`, `bans(profile_id) WHERE lifted_at IS NULL`.

### 5.1 RLS posture

- RLS **enabled on every table**; the anon role has **no direct table SELECT and no write policies at all**.
- Public reads happen only through:
  - **Views** (with masking): `posts_feed` (joins author username/avatar/role, flair name/color, first attachment; excludes `removed_at IS NOT NULL` posts entirely) and `comments_thread` (all rows for thread shape, but `body`/`gif_url`/author nulled and `removed=true` flag when removed — the "[removed]" tombstone).
  - **RPCs** (`SECURITY INVOKER`, reading the views): `get_feed(p_sort text, p_flair int, p_cursor jsonb, p_limit int)` and `get_thread(p_post uuid, p_sort text)`; `get_profile_stats(p_username text)` for hovercards.
- `get_feed` sorts: `new` (created_at desc), `top` (score desc, all-time in v1), `hot` (Reddit's classic: `log10(greatest(abs(score),1)) + sign(score) * extract(epoch from created_at - '2026-01-01'::timestamptz)/45000`). Keyset pagination on `(sort_key, id)` via the `p_cursor` jsonb.
- Write RPCs (`SECURITY DEFINER`, callable **only** by service role): `cast_vote(p_profile uuid, p_type text, p_id uuid, p_value smallint)` — upserts/toggles the vote, adjusts `score` and author karma in one transaction and returns the new totals; `create_comment(...)` — inserts, computes `depth` from parent, bumps `comment_count`.

### 5.2 Storage

- Bucket **`forum-media`**, public read.
- Upload flow: `POST /api/forum/uploads` validates session + active-ban + `{content_type, size}` against caps → returns signed upload URL(s) for `{kick_id}/{yyyy-mm}/{uuid}.{ext}` → browser uploads directly (XHR, progress events) → `POST /api/forum/posts` submits the storage paths → route verifies every path starts with the caller's `kick_id/`.
- Caps (env-overridable): images 10MB — `image/jpeg|png|webp|gif`; video `FORUM_MAX_VIDEO_MB` default **50** (Supabase free-tier per-file limit) — `video/mp4|webm`. Max 6 images or 1 video per post.
- No transcoding in v1: videos play as uploaded via native `<video>`. Orphaned uploads (uploaded but never attached) are out of scope for v1.

## 6. API design (`src/app/api/forum/…`, Node runtime)

All handlers: verify `forum_session` → load profile by `kick_id` → check active ban (writes only) → act via service client / write RPCs → JSON. Errors: `{ code, error }` with 400/401/403/404/413; 401 → client shows sign-in prompt; 403 with `code:"banned"` includes `{reason, expires_at}`.

| Route | Method(s) | Notes |
|---|---|---|
| `/api/forum/me` | GET | `{profile, role, ban}` or `{signedOut:true}` — the UI gate |
| `/api/forum/uploads` | POST | `{files:[{content_type,size}]}` → signed URLs + final paths |
| `/api/forum/posts` | POST | `{title, flair_id, body?, attachments?[], clip_url?}` — parses clip URLs server-side too (canonical validation); sets `kind` |
| `/api/forum/posts/[id]` | PATCH, DELETE | PATCH: own body edit. DELETE: author self-delete (soft removal, `removal_reason='author'`) or mod/admin remove with `{reason}`; both soft → mod removals also append to `mod_log` |
| `/api/forum/comments` | POST | `{post_id, parent_id?, body?, gif_url?}` → `create_comment` RPC (depth cap 8) |
| `/api/forum/comments/[id]` | PATCH, DELETE | Same ownership/mod rules as posts |
| `/api/forum/vote` | POST | `{subject_type, subject_id, value: -1\|0\|1}` (0 = retract) → `cast_vote` |
| `/api/forum/gif-search` | GET | `?q=&limit=` → Tenor v2 proxy, key server-side, 60s cache headers |
| `/api/forum/mod/bans` | POST, DELETE | Ban `{profile_id, reason, days?}` / lift. Mod+ |
| `/api/forum/mod/roles` | POST | `{profile_id, role}` — **admin only**; cannot demote yourself if last admin |
| `/api/forum/mod/flairs` | POST, PATCH, DELETE | Flair CRUD — **admin only** |
| `/api/forum/mod/queue` | GET | Recently removed content + recent mod_log. Mod+ |

Permission matrix: **User** — create/edit/delete own content, vote. **Moderator** — + remove any post/comment (with reason), ban/unban. **Admin** — + flair CRUD, role management. All mod/admin actions append to `mod_log`.

## 7. Frontend

Routes (all inherit existing `SiteChrome` header/footer):

- `/community` — replaces the "coming soon" page: sort tabs (Hot/New/Top) + flair chip filter bar (existing chip styling; state in URL `?sort=&flair=`) + infinite-scroll feed + Create Post button (links to sign-in when logged out).
- `/community/submit` — composer page.
- `/community/post/[id]` — post detail + comments.
- `/community/mod` — mod tools; role-gated client-side by `/me` and server-side per action.

Components (`src/components/forum/`):

| Component | Behavior |
|---|---|
| `ForumFeed` | `get_feed` RPC via browser supabase client; IntersectionObserver infinite scroll; skeleton cards |
| `PostCard` | Vote rail, flair chip, title, author + `UserHovercard`, `MediaViewer`, comment count, relative time; inline mod actions when role ≥ moderator |
| `MediaViewer` | One rounded, aspect-capped media frame; dispatches to image gallery / `VideoPlayer` / `ClipEmbed` so uploads and clips are visually identical |
| `VideoPlayer` | Native `<video>`; muted autoplay at ≥60% visibility, pause off-screen; click-to-unmute; single-unmuted-player bus; custom controls: play/pause, scrubber + buffered bar, volume (persisted to localStorage), time, fullscreen |
| `ClipEmbed` | `parseClipUrl()` → official Kick clip embed or `clips.twitch.tv/embed?clip={id}&parent={vercel,github.io,localhost}&muted=true`; iframe mounts lazily on scroll-into-view (exact Kick clip-embed URL format verified at implementation) |
| `Composer` | Title, required flair select, body, media tab: multi-image/video upload with per-file progress, or clip-link paste with live preview |
| `CommentThread` / `CommentNode` | Tree from `get_thread`; collapse/expand; indent capped at depth 8 → "continue this thread" link; inline reply; `[removed]` tombstones |
| `GifPicker` | Popover; Tenor search via `/api/forum/gif-search`; grid of previews; picks `gif_url` |
| `VoteRail` | Optimistic ±, reconciles with RPC totals; login prompt when signed out |
| `UserHovercard` | 300ms hover intent (desktop) / tap (mobile). Kick data via keyless client-side `kick.com/api/v2/channels/{username}` (sessionStorage cache, degrade-gracefully pattern from `src/lib/kick.ts`): avatar, verified badge, follower count, Kick join date (sourced from the channel payload's created-at field — exact field verified at implementation; line hidden if absent). Forum data via `get_profile_stats`: karma, forum member-since, role badge |
| `ModTools` | Tabs: Queue (removed content), Bans (issue/lift), Flairs (admin), Roles (admin) |

Visual language: existing dark theme + gold `accent`, `border-line` chips, `ui.tsx` primitives. Reddit-compact card density, LSF-style flair colors.

**Pages mirror behavior:** reads work (client-direct); all write affordances deep-link to the Vercel origin (reuse the `NEXT_PUBLIC_HLS_PROXY`-style env pattern → `NEXT_PUBLIC_APP_ORIGIN`).

## 8. Error handling

- Write routes: typed error JSON (above); client toast + inline states. Banned → persistent banner with reason/expiry.
- Session expiry: `/me` 401 → header shows Sign in; `KickSessionKeeper` already keeps Kick tokens fresh; `forum_session` lives the full 60d window in parallel.
- Reads: RPC failure → retry once, then error card with reload (feed) / degrade to cached (hovercard hides Kick section on fetch failure — never blocks the card).
- Uploads: per-file retry; clear message when exceeding size caps *before* uploading.

## 9. Testing

- **vitest** (new devDependency, first test infra in repo) for pure logic only: `parseClipUrl`, `forumSession` sign/verify/expiry, feed-cursor encode/decode.
- SQL functions exercised by a `supabase/seed.sql` + manual RPC smoke calls against the dev project.
- UI verified per phase with the preview browser tools (feed scroll/autoplay, composer flows, comment threading, hovercards, mod actions).

## 10. Build phases (each independently shippable)

1. **Foundation:** migration + RLS + seed flairs; callback extension (kick_id capture, profile upsert, `forum_session`); `forumSession.ts`; `/api/forum/me`; setup doc.
2. **Text forum:** `get_feed`, feed page + tabs + flair filter, submit page (text), post page.
3. **Comments + votes:** `get_thread`, thread UI, `cast_vote`, vote rail, karma.
4. **Media:** uploads route + storage, composer media tab, `MediaViewer`, `VideoPlayer`, `ClipEmbed` + `parseClipUrl`.
5. **GIFs + hovercards:** Tenor proxy + `GifPicker`; `UserHovercard` + `get_profile_stats`.
6. **Moderation:** mod routes, `ModTools`, inline mod actions, bans enforcement, `mod_log`.

## 11. Environment variables

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + Pages | existing client reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only | write routes |
| `FORUM_SESSION_SECRET` | Vercel only | HMAC for `forum_session` |
| `FORUM_ADMIN_KICK_IDS` | Vercel only | admin bootstrap allowlist |
| `TENOR_API_KEY` | Vercel only | GIF search proxy |
| `FORUM_MAX_VIDEO_MB` | Vercel only (optional) | default 50 |
| `NEXT_PUBLIC_APP_ORIGIN` | Pages build | write deep-links from the read-only mirror |

## 12. Out of scope (v1)

Video transcoding/HLS for uploads; realtime live-updating comments (client-direct reads make Supabase Realtime an easy later add); markdown rendering; post search; user-to-user DMs; notifications for replies; orphaned-upload garbage collection; report/flag queue (mods act directly in v1).
