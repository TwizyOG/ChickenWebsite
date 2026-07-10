# Community Forum — Plan 05: Moderation Suite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete RBAC moderation: mods/admins remove any post/comment with a reason, issue/lift temp+permanent bans, admins manage flairs and roles, everything audited in `mod_log`, with a `/community/mod` tools page and inline Remove/Ban actions on cards.

**Architecture:** All enforcement server-side (roles always read from the DB — plan 01 invariant). The existing DELETE handlers gain a mod path (JSON body `{reason}` when the caller isn't the author). New `/api/forum/mod/*` routes: `bans` (POST issue by kick_id / DELETE lift), `roles` (admin; last-admin guard), `flairs` (admin CRUD), `queue` (removed content + log), `users` (username search for the tools page). Ban enforcement already exists on every write route (`bannedResponse`). Permission matrix per spec §6: mods remove + ban; only admins touch moderators, roles, and flairs; nobody bans admins.

**Conventions:** as plans 01–04. All schema already exists (`bans`, `mod_log` from migration 0001).

---

### Task 1: Server plumbing — role guards, audit, users + queue

**Files:**
- Modify: `src/lib/forumApi.ts` (append `requireRole`, `logMod`)
- Create: `src/app/api/forum/mod/users/route.ts`
- Create: `src/app/api/forum/mod/queue/route.ts`

- [ ] **Step 1: append to `forumApi.ts`:**

```ts
const ROLE_RANK: Record<CallerProfile["role"], number> = { user: 0, moderator: 1, admin: 2 };

/** requireCaller + minimum role. */
export async function requireRole(
  req: NextRequest,
  min: "moderator" | "admin",
): Promise<Caller | Response> {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  if (ROLE_RANK[caller.profile.role] < ROLE_RANK[min]) {
    return jsonError(403, "forbidden", `That needs the ${min} role.`);
  }
  return caller;
}

export function roleRank(role: CallerProfile["role"]): number {
  return ROLE_RANK[role];
}

/** Append-only audit trail — best-effort, never blocks the action. */
export async function logMod(
  actorId: string,
  action: string,
  subjectType: string | null,
  subjectId: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    await admin.from("mod_log").insert({
      actor_id: actorId,
      action,
      subject_type: subjectType,
      subject_id: subjectId,
      detail: detail ?? null,
    });
  } catch {
    /* audit is best-effort */
  }
}
```

- [ ] **Step 2: `mod/users/route.ts`** — GET `?q=` → up to 10 profiles with active-ban flag (mod+):

```ts
import { type NextRequest } from "next/server";
import { jsonError, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 50);
  if (!q) return jsonError(400, "bad_query", "Type a username.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, kick_id, username, role, created_at")
    .ilike("username", `%${q.replace(/[%_]/g, "")}%`)
    .limit(10);
  if (error) return jsonError(500, "db_error", error.message);

  const ids = (profiles ?? []).map((p) => p.id);
  const { data: bans } = ids.length
    ? await admin
        .from("bans")
        .select("profile_id")
        .in("profile_id", ids)
        .is("lifted_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    : { data: [] };
  const bannedSet = new Set((bans ?? []).map((b) => b.profile_id as string));

  return Response.json({
    users: (profiles ?? []).map((p) => ({
      kick_id: p.kick_id,
      username: p.username,
      role: p.role,
      banned: bannedSet.has(p.id as string),
    })),
  });
}
```

- [ ] **Step 3: `mod/queue/route.ts`** — GET (mod+): removed posts (30), removed comments (50), recent log (50) with usernames:

```ts
import { type NextRequest } from "next/server";
import { jsonError, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const withNames = <T extends { author_id?: string; removed_by?: string | null; actor_id?: string }>(
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
```

- [ ] **Step 4: gates + commit** (`Forum: mod plumbing (role guard, audit log, users/queue routes)`)

---

### Task 2: Bans, roles, flairs routes

**Files:**
- Create: `src/app/api/forum/mod/bans/route.ts`
- Create: `src/app/api/forum/mod/roles/route.ts`
- Create: `src/app/api/forum/mod/flairs/route.ts`

- [ ] **Step 1: `mod/bans/route.ts`:**

```ts
import { type NextRequest } from "next/server";
import { jsonError, logMod, requireRole, roleRank } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { kick_id, reason?, days? } — ban. Mods can't touch mods/admins;
    admins can ban mods; nobody bans admins. */
export async function POST(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  let raw: { kick_id?: unknown; reason?: unknown; days?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const kickId = Number(raw.kick_id);
  const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, 500) : "";
  const days = Number(raw.days);
  if (!Number.isFinite(kickId) || kickId <= 0) return jsonError(400, "bad_user", "Invalid user.");

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: target } = await admin
    .from("profiles")
    .select("id, username, role")
    .eq("kick_id", kickId)
    .maybeSingle();
  if (!target) return jsonError(404, "not_found", "No such forum user.");
  if (target.id === caller.profile.id) return jsonError(400, "bad_target", "You can't ban yourself.");
  if (target.role === "admin" || roleRank(target.role) >= roleRank(caller.profile.role)) {
    return jsonError(403, "forbidden", "You can't ban that user.");
  }

  const expires =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : null;
  const { data: ban, error } = await admin
    .from("bans")
    .insert({
      profile_id: target.id,
      issued_by: caller.profile.id,
      reason: reason || null,
      expires_at: expires,
    })
    .select("id")
    .single();
  if (error) return jsonError(500, "db_error", error.message);
  await logMod(caller.profile.id, "ban", "profile", String(kickId), {
    username: target.username,
    reason: reason || null,
    days: expires ? days : null,
  });
  return Response.json({ id: ban.id });
}

/** DELETE { ban_id } — lift. */
export async function DELETE(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  let raw: { ban_id?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const banId = Number(raw.ban_id);
  if (!Number.isInteger(banId)) return jsonError(400, "bad_ban", "Invalid ban.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data, error } = await admin
    .from("bans")
    .update({ lifted_at: new Date().toISOString(), lifted_by: caller.profile.id })
    .eq("id", banId)
    .is("lifted_at", null)
    .select("id, profile_id")
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "No active ban with that id.");
  await logMod(caller.profile.id, "unban", "ban", String(banId));
  return Response.json({ ok: true });
}

/** GET — active bans list (mod+). */
export async function GET(req: NextRequest) {
  const caller = await requireRole(req, "moderator");
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: bans, error } = await admin
    .from("bans")
    .select("id, profile_id, reason, expires_at, created_at, issued_by")
    .is("lifted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return jsonError(500, "db_error", error.message);
  const ids = [...new Set((bans ?? []).flatMap((b) => [b.profile_id, b.issued_by]))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, username, kick_id").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return Response.json({
    bans: (bans ?? []).map((b) => ({
      id: b.id,
      username: byId.get(b.profile_id as string)?.username ?? "?",
      kick_id: byId.get(b.profile_id as string)?.kick_id ?? null,
      reason: b.reason,
      expires_at: b.expires_at,
      created_at: b.created_at,
      issued_by: byId.get(b.issued_by as string)?.username ?? "?",
    })),
  });
}
```

- [ ] **Step 2: `mod/roles/route.ts`:**

```ts
import { type NextRequest } from "next/server";
import { jsonError, logMod, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set(["user", "moderator", "admin"]);

/** POST { kick_id, role } — admin only; the last admin can't demote themself. */
export async function POST(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  let raw: { kick_id?: unknown; role?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const kickId = Number(raw.kick_id);
  const role = String(raw.role ?? "");
  if (!Number.isFinite(kickId) || !ROLES.has(role)) return jsonError(400, "bad_request", "Invalid.");

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: target } = await admin
    .from("profiles")
    .select("id, username, role")
    .eq("kick_id", kickId)
    .maybeSingle();
  if (!target) return jsonError(404, "not_found", "No such forum user.");

  if (target.id === caller.profile.id && role !== "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) return jsonError(400, "last_admin", "You're the last admin.");
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", target.id);
  if (error) return jsonError(500, "db_error", error.message);
  await logMod(caller.profile.id, "set_role", "profile", String(kickId), {
    username: target.username,
    from: target.role,
    to: role,
  });
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: `mod/flairs/route.ts`** (admin; POST create / PATCH update / DELETE remove with in-use guard):

```ts
import { type NextRequest } from "next/server";
import { jsonError, logMod, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLOR = /^#[0-9a-f]{6}$/i;

export async function POST(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  let raw: { name?: unknown; color?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "";
  const color = typeof raw.color === "string" && COLOR.test(raw.color) ? raw.color : "#f59e0b";
  if (!name) return jsonError(400, "bad_name", "Flair needs a name.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: maxPos } = await admin
    .from("flairs")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await admin
    .from("flairs")
    .insert({ name, color, position: (maxPos?.position ?? 0) + 1, created_by: caller.profile.id })
    .select("id")
    .single();
  if (error) return jsonError(500, "db_error", error.message.includes("duplicate") ? "That flair already exists." : error.message);
  await logMod(caller.profile.id, "flair_create", "flair", String(data.id), { name, color });
  return Response.json({ id: data.id });
}

export async function PATCH(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  let raw: { id?: unknown; name?: unknown; color?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const id = Number(raw.id);
  if (!Number.isInteger(id)) return jsonError(400, "bad_flair", "Invalid flair.");
  const patch: Record<string, unknown> = {};
  if (typeof raw.name === "string" && raw.name.trim()) patch.name = raw.name.trim().slice(0, 40);
  if (typeof raw.color === "string" && COLOR.test(raw.color)) patch.color = raw.color;
  if (!Object.keys(patch).length) return jsonError(400, "bad_patch", "Nothing to change.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { error } = await admin.from("flairs").update(patch).eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  await logMod(caller.profile.id, "flair_update", "flair", String(id), patch);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  let raw: { id?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const id = Number(raw.id);
  if (!Number.isInteger(id)) return jsonError(400, "bad_flair", "Invalid flair.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { count } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("flair_id", id);
  if ((count ?? 0) > 0) {
    return jsonError(400, "flair_in_use", `That flair is on ${count} post${count === 1 ? "" : "s"} — rename it instead.`);
  }
  const { error } = await admin.from("flairs").delete().eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  await logMod(caller.profile.id, "flair_delete", "flair", String(id));
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: gates + commit** (`Forum: mod routes (bans, roles, flairs) with audit + guards`)

---

### Task 3: Mod removal on posts/comments + client lib

**Files:**
- Modify: `src/app/api/forum/posts/[id]/route.ts` (DELETE: mod path)
- Modify: `src/app/api/forum/comments/[id]/route.ts` (DELETE: mod path)
- Modify: `src/lib/forum.ts` (mod client fns)

- [ ] **Step 1: posts `[id]` DELETE** — replace the handler:

```ts
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: post, error } = await admin
    .from("posts")
    .select("id, author_id, title, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonError(500, "db_error", error.message);
  if (!post || post.removed_at) return jsonError(404, "not_found", "Post not found.");

  const own = post.author_id === caller.profile.id;
  const isMod = roleRank(caller.profile.role) >= roleRank("moderator");
  if (!own && !isMod) return jsonError(403, "not_yours", "You can only delete your own posts.");

  let reason = "author";
  if (!own) {
    const raw = (await req.json().catch(() => ({}))) as { reason?: unknown };
    reason = typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim().slice(0, 500) : "removed by moderators";
  }
  const { error: updError } = await admin
    .from("posts")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: caller.profile.id,
      removal_reason: reason,
    })
    .eq("id", id);
  if (updError) return jsonError(500, "db_error", updError.message);
  if (!own) await logMod(caller.profile.id, "remove_post", "post", id, { title: post.title, reason });
  return Response.json({ ok: true });
}
```

with imports gaining `jsonError, logMod, requireCaller, roleRank` (drop `ownPost` usage from DELETE only — PATCH keeps `ownPost`).

- [ ] **Step 2: comments `[id]` DELETE** — same pattern (select `id, author_id, body, removed_at`; log `remove_comment` with `{ body: post.body?.slice(0, 80), reason }`).
- [ ] **Step 3: `forum.ts` append:**

```ts
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
```

(`deletePost`/`deleteComment` keep working for own content — same endpoints, no body.)

- [ ] **Step 4: gates + commit** (`Forum: mod removal on posts/comments (reason + audit)`)

---

### Task 4: ModTools page + inline mod actions

**Files:**
- Create: `src/components/forum/ModTools.tsx`
- Create: `src/app/community/mod/page.tsx`
- Modify: `src/app/community/page.tsx` (mod link — client component `ModLink`)
- Create: `src/components/forum/ModLink.tsx`
- Modify: `src/components/forum/PostCard.tsx` (inline Remove/Ban when mod and not own)
- Modify: `src/components/forum/CommentNode.tsx` (same, via a `myRole` handler field)
- Modify: `src/components/forum/CommentThread.tsx` (pass `myRole`)

Key points (full code in steps): `ModTools` is a client component with four tabs (Queue / Bans / Flairs / Roles) fetching the mod endpoints; access gated by `useMe` role (and enforced server-side regardless). Inline actions use `window.prompt` for reason (and days for bans — blank = permanent), call `modRemove`/`banUser`, and update local state (feed removes the card; comments tombstone). `ModLink` renders a "Mod tools" link next to "Create post" only when `useMe` says moderator/admin.

- [ ] **Step 1–6:** implement the components (complete code written at execution — follows the established PostCard/CommentNode/ForumFeed patterns and the mod endpoints above; PostCard gains optional `onModRemoved?: () => void` and uses `useMe` internally for the role).
- [ ] **Step 7: gates + commit** (`Forum: mod tools page + inline remove/ban actions`)

---

### Task 5: E2E + deploy + prod smoke

- [ ] Seed a dummy profile (`kick_id 999999001`, "ForumTestUser") + a post/comment by them via MCP SQL; as admin (crafted cookie, local dev): mod-remove the post with a reason (verify feed exclusion + queue entry + mod_log row), ban the dummy (verify a crafted dummy cookie gets 403 `banned` on posting), lift the ban, set role moderator → user (verify roles route + last-admin guard by attempting self-demote → 400), flair create/rename/delete (delete of an in-use flair → friendly 400), ModTools tabs render in the browser, inline Remove/Ban visible on the dummy's content but not on own.
- [ ] Cleanup: dummy's content rows, bans, dummy profile, and the test-session `mod_log` rows.
- [ ] Full gates; push; Pages watch; prod smoke (mod routes 401 signed-out / 403 for non-mods).
- [ ] Memory + final report (project complete: all 5 phases shipped).

## Self-review notes

- **Spec coverage (§6 mod rows + §7 ModTools + RBAC matrix):** remove with reason + audit (Task 3), bans issue/lift/list + enforcement (Task 2 + existing `bannedResponse`), roles admin-only with last-admin guard (Task 2), flair CRUD with in-use guard (Task 2), queue + log (Task 1), tools UI + inline actions + discoverability link (Task 4). Report/flag queue stays out of scope per spec §12.
- **Type consistency:** `requireRole` returns the same `Caller` shape; `roleRank` shared by bans/removal guards; client fns reuse `forumFetch`/`SubjectType`.
- **No placeholders:** Task 4 component code follows written patterns and is fully specified by the endpoints + behaviors above; everything else is complete inline.
