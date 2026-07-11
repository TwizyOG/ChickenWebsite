# Forum Plan 06 — Engagement & Discovery — Design Spec

**Date:** 2026-07-11
**Status:** Approved (design sign-off 2026-07-11)
**Feature:** Post-launch upgrade pack for the `/community` forum: reply/mod notifications in the site bell, realtime thread/feed/bell updates, post search, and a user report queue for mods.

## 1. Goals

- Users learn when someone replies to their post/comment, or when mods remove their content — via the **existing site-wide header bell**, with server-backed read state.
- Open threads update live (new comments, score changes); the feed shows a "new posts" pill; the bell badge updates without reload.
- Full-text post search from `/community`, shareable via `?q=`, working read-only on the Pages mirror.
- Signed-in users report posts/comments with a reason; mods triage in a new ModTools **Reports** tab; removals auto-resolve reports.

## 2. Context and constraints

- **Forum v1 complete:** plans 01–05 shipped all six phases of the 2026-07-05 spec. Architecture (approach C): anon client-direct reads via masked views (`posts_feed`, `comments_thread`, `profiles_public`) + `get_feed` RPC; all writes via `/api/forum/*` (Node runtime) with `SUPABASE_SERVICE_ROLE_KEY`; identity = HMAC `forum_session` cookie ([src/lib/forumSession.ts](../../../src/lib/forumSession.ts)), plumbing in [src/lib/forumApi.ts](../../../src/lib/forumApi.ts) (`requireCaller`, `requireRole`, `bannedResponse`, `logMod`).
- **Identity constraint (drives realtime):** users have no Supabase Auth JWT, so Realtime private channels / `postgres_changes`-under-RLS are unusable per-user. Granting anon SELECT on raw tables to make `postgres_changes` work would leak masked fields (removed bodies) — rejected. → **Broadcast pings** (§5).
- **The header bell already exists:** [src/components/Header.tsx](../../../src/components/Header.tsx) renders a bell + dropdown + unread badge fed by localStorage notices ([src/lib/notifications.ts](../../../src/lib/notifications.ts), kinds `live | account`, `ca:notices`, explicit "Mark all as read" button). Forum notifications merge into it — no second bell.
- **RLS posture stays:** deny-all tables; public read surface = postgres-owned views/RPCs. New private data (notifications, reports) is service-role-only, read through authed routes (precedent: `/api/forum/me`, `/api/forum/mod/*`).
- **Pages mirror:** no API routes → notifications/report writes unavailable; search + realtime thread/feed pings still work (anon reads + anon websocket). Forum bell section degrades silently to local notices. Write affordances keep the established `NEXT_PUBLIC_APP_ORIGIN` deep-link pattern.
- Migrations 0001/0002 applied; this plan adds **`0003_forum_v2.sql`** (idempotent, dashboard SQL editor — no CLI). No new env vars.

## 3. Decisions (from brainstorm Q&A)

| Decision | Choice |
|---|---|
| Plan 06 scope | All four §12-deferred features: notifications, realtime, search, reports (user multi-selected) |
| Realtime mechanism | **Broadcast pings** — content-free events on public channels; clients refetch via existing masked RPCs |
| Notification surface | **Existing header bell**, merged with localStorage notices |
| Search backend | **Postgres FTS** (weighted generated tsvector + GIN + ranked RPC); no external service |
| Mod anonymity | Removal notifications say "Moderators", never the acting mod (audit stays in `mod_log`) |
| Reply semantics | Top-level comment → notifies post author (`reply_post`); nested → parent comment author (`reply_comment`); never self |

## 4. Database (migration `0003_forum_v2.sql`)

```sql
notifications (
  id          bigserial PK,
  profile_id  uuid NOT NULL REFERENCES profiles(id),   -- recipient
  kind        text NOT NULL CHECK (kind IN
                ('reply_post','reply_comment','mod_remove_post','mod_remove_comment')),
  actor_id    uuid REFERENCES profiles(id),            -- never exposed for mod_remove_*
  post_id     uuid REFERENCES posts(id),
  comment_id  uuid REFERENCES comments(id),            -- the reply / removed comment
  detail      jsonb,        -- render snapshot: {post_title, excerpt} / {post_title|excerpt, reason}
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- idx: (profile_id, created_at DESC); partial (profile_id) WHERE read_at IS NULL

reports (
  id           bigserial PK,
  reporter_id  uuid NOT NULL REFERENCES profiles(id),
  subject_type text NOT NULL CHECK (subject_type IN ('post','comment')),
  subject_id   uuid NOT NULL,
  reason       text NOT NULL CHECK (reason IN ('spam','harassment','nsfw','misinfo','other')),
  detail       text CHECK (char_length(detail) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES profiles(id),
  resolution   text CHECK (resolution IN ('dismissed','removed'))
)
-- UNIQUE partial idx (reporter_id, subject_type, subject_id) WHERE resolved_at IS NULL  ← dedupe
-- partial idx (created_at DESC) WHERE resolved_at IS NULL                               ← queue
```

Both tables: RLS enabled, **zero policies** (service-role only).

**Search DDL:**

```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(body,'')),  'B')
  ) STORED;
-- GIN index on search_tsv
```

`search_posts(p_q text, p_flair int default null, p_limit int default 25, p_offset int default 0)`
→ `SETOF posts_feed`, `SECURITY DEFINER` (postgres-owned read surface — same accepted posture as the masked views; advisors already flag this pattern as by-design). Internals: `websearch_to_tsquery('english', p_q)` (never raises; phrases/negation supported) against `posts.search_tsv`, joined to `posts_feed` on id (so removal masking is inherited), ordered `ts_rank DESC, created_at DESC, id DESC`, `p_limit` clamped 1–50, `p_offset` clamped 0–200. Grant execute to `anon, authenticated`.

**`create_comment` v2:** `CREATE OR REPLACE` with the **same signature** (routes unchanged). After the insert it also inserts reply notifications in the same transaction: parent NULL → post author gets `reply_post`; else parent's author gets `reply_comment`; skipped when recipient = commenter. `detail` snapshot: `{post_title, excerpt}` (excerpt = first 140 chars of body, or `[gif]`).

## 5. Realtime architecture (broadcast pings)

- **Server:** `src/lib/forumRealtime.ts` — `broadcastPing(topic, event, payload?)`: fire-and-forget POST to Supabase Realtime's broadcast REST endpoint (`{SUPABASE_URL}/realtime/v1/api/broadcast`, service key, `{messages:[{topic, event, payload}]}`) — exact endpoint shape verified at implementation (clip-embed precedent); fallback is a server-side supabase-js channel `send()`. Best-effort like `logMod`: never blocks or fails the write.
- **Ping sites (after successful write):**
  - `POST /api/forum/comments` → `post:{post_id}` `comments` + `user:{recipient_kick_id}` `notif` (recipients read back from `notifications WHERE comment_id = new_id` joined to profiles — no RPC signature change)
  - `POST /api/forum/votes` → `post:{post_id}` `votes`
  - `POST /api/forum/posts` → `feed` `posts` `{post_id}`
  - mod/author DELETE routes → `post:{post_id}` `removed` (+ `user:{author_kick_id}` `notif` for mod removals)
- **Client:** `src/lib/forumLive.ts` — `useLiveChannel(topic, events, onPing)`: no-op when the browser Supabase client is unconfigured; subscribes on mount, cleans up on unmount; coalesces bursts (≥3s between `onPing` fires). Consumers:
  - `PostView`/thread: `post:{id}` → silent thread+post refetch (existing RPCs)
  - `ForumFeed`: `feed` → counts pings → "N new posts — Show" pill → refetch page 1, scroll top (no auto-insert; infinite scroll stays stable)
  - Bell: `user:{kick_id}` → refetch unread count (plus window-focus refetch; **no interval polling**)
- **Security note:** channels are public-subscribable by design; payloads carry ids only. A snoop learns "public activity happened on post X" — already public data. All content still flows through masked views. Free-tier Realtime limits (200 concurrent, 2M msgs/mo) are far above this site's scale.

## 6. API design (`src/app/api/forum/…`, Node runtime)

Same conventions as v1: verify `forum_session` → load profile → act via service client → `{code, error}` JSON on failure.

| Route | Method | Notes |
|---|---|---|
| `/api/forum/notifications` | GET | `?limit=` (default 30, max 50) `&before=` (id cursor) `&count_only=1`. → `{notifications:[…], unread}` with joined actor `username`/`avatar` (actor omitted on `mod_remove_*`). **No ban gate on reads** — banned users may see why. |
| `/api/forum/notifications` | POST | `{all:true}` or `{ids:number[]}` → sets `read_at`, returns `{unread}`. Only own rows. |
| `/api/forum/reports` | POST | `{subject_type, subject_id, reason, detail?}`. Guards: ban gate (403); subject exists & not removed (404); not own content (400 `own_content`); ≤25 open reports per reporter (429 `too_many_reports`); duplicate open report → `200 {already:true}`. |
| `/api/forum/mod/reports` | GET | Mod+. Open reports **grouped by subject**: count, reason tallies, up to 5 reporter usernames, first/last timestamps, content preview (title/body excerpt, author, current removed state). Order last-reported DESC, limit 50. |
| `/api/forum/mod/reports` | POST | Mod+. `{subject_type, subject_id, action:'dismiss'}` → resolves all open reports on the subject (`resolution='dismissed'`) + `logMod('report_dismiss')`. |

**Removal integration:** the existing post/comment DELETE handlers (mod path) additionally resolve all open reports on that subject (`resolution='removed'`, best-effort) and insert the `mod_remove_*` notification. Author self-delete → no notification, but open reports on it still resolve as `removed`.

## 7. Frontend

| Piece | Behavior |
|---|---|
| `src/lib/forumNotifications.ts` (client) | Fetch list/count, mark-read; returns `{notifications:[], unread:0}` on any failure (mirror-safe). Maps rows to bell items: `reply_post` "*{actor} replied to your post*" (sub = post title), `reply_comment` "*{actor} replied to your comment*" (sub = excerpt), `mod_remove_*` "*Moderators removed your post/comment*" (sub = reason). `href` = `/community/post?id={post_id}#c-{comment_id}`. |
| [Header.tsx](../../../src/components/Header.tsx) bell | Gated on `currentKickUser()`; uses `useMe` (shared fetch, also self-heals the forum session) for `kick_id`. Badge = local unread + forum unread. Dropdown merges both sources sorted by time; the existing "Mark all as read" button clears **both** stores (current behavior: an explicit button, not mark-on-open). Forum items navigate on click. |
| `CommentNode` | Gains `id="c-{comment.id}"` anchors; `PostView` scrolls to `location.hash` after thread load. |
| `SearchBar` (in `/community`) | Input beside sort tabs; debounced push to `?q=` (URL-shareable). While searching: `ForumFeed` calls `search_posts` (rank order), sort tabs hidden, flair chips still filter (`p_flair`), offset "Load more" (≤200), clear empty state. Empty/whitespace query → back to normal feed, no RPC call. |
| `ReportDialog` | Popover from a "Report" action on `PostCard`/`CommentNode` (never on own content; signed-out click → sign-in prompt, same as `VoteRail`): reason radios + optional text + submit → success state; `already:true` renders the same "Reported — thanks". Mirror: deep-links to the Vercel origin like other write affordances. |
| `ModTools` → **Reports** tab | Fifth tab (mod+): grouped open reports w/ preview + reporter chips + reason tallies; **Dismiss** (mod/reports POST) and **Remove content** (existing removal flow w/ reason prompt — auto-resolves) update local state. |

## 8. Error handling

- Notifications/report routes reuse the v1 typed-error contract; 401 → sign-in prompt; banned reporting → existing ban banner pattern.
- Realtime is enhancement-only: subscribe failures or missing Supabase config degrade to fetch-on-open/focus (bell) and manual refresh (thread/feed) — no user-facing errors, mirroring the hovercard degrade pattern.
- Bell fetch failure hides the forum section, never the bell (local notices always render).
- Search RPC failure → same retry-once-then-error-card pattern as the feed.

## 9. Testing

- **vitest (pure logic):** bell item mapping/merge/sort; excerpt builder; search query/param handling in the feed lib.
- **SQL smoke (Supabase MCP):** `create_comment` v2 writes correct notification rows (top-level vs nested vs self-reply-skip); `search_posts` ranking/masking (removed posts absent); report dedupe unique-violation; auto-resolve on removal.
- **Browser E2E (fresh crafted cookies — they expire 1–2h):** reply as dummy → bell badge/dropdown/mark-read as author; two-tab realtime (comment in tab A → tab B thread updates; feed pill; bell count); search box → ranked results + `?q=` deep-link; report as dummy → Reports tab grouping → dismiss + remove paths (remove resolves + notifies).
- Gates per track: `npm run lint`, `npm run build`, `npx vitest run` — forum files stay at zero lint errors (repo has ~12 pre-existing unrelated errors).

## 10. Build tracks (each independently shippable, plan-05 commit style)

1. **Migration 0003 + notifications backend** — migration file (notifications + reports + search DDL/RPC); `create_comment` v2; removal-route notification inserts; `/api/forum/notifications` GET/POST.
2. **Header bell integration** — `forumNotifications.ts`, Header merge, comment anchors.
3. **Realtime** — `forumRealtime.ts` + route pings; `useLiveChannel`; thread refetch, feed pill, live bell count.
4. **Search UI** — `SearchBar` + `ForumFeed` search mode (RPC ships in track 1's migration).
5. **Reports** — `/api/forum/reports`, `/api/forum/mod/reports`, `ReportDialog`, ModTools Reports tab, removal-route auto-resolve wiring.
6. **E2E + deploy + prod smoke** — staged flows above; push; Pages watch; prod checks (notifications 401 signed-out; search on mirror; report 401/403).

**Operational step (user):** run `0003_forum_v2.sql` in the dashboard SQL editor right after track 1 lands. Until then, code degrades: old `create_comment` keeps working (no notifications), bell hides its forum section, search box falls back to the error card. Realtime needs no project toggle.

## 11. Environment variables

None new. Uses existing `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` (client reads + websocket), `SUPABASE_SERVICE_ROLE_KEY` (routes + broadcast REST), `NEXT_PUBLIC_APP_ORIGIN` (mirror deep-links).

## 12. Out of scope (plan 06)

@-mention notifications; email/web-push delivery; notification preferences/muting; comment search; report rate-limiting beyond dedupe + open-cap; realtime presence/typing indicators; live vote counts on feed cards (thread only); auto-inserting new feed posts (pill instead).
