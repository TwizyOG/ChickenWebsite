# Community Forum — Plan 04: Tenor GIFs + Kick Hovercards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comments accept GIFs via a Tenor search popover (gif-only comments allowed), and every username on the forum shows a hovercard with live Kick data (avatar, verified, followers, join date) + forum stats (karma, member since, role).

**Architecture:** Tenor is proxied through `GET /api/forum/gif-search` (key server-side, `TENOR_API_KEY`; 501 + graceful UI when unset). `gif_url` already exists on `comments` and in `create_comment`/`comments_thread` (plan 01/02) — only the route hardcodes null today. Hovercards fetch `kick.com/api/v2/channels/{username}` client-side keyless (the `src/lib/kick.ts` pattern; join date = `chatroom.created_at`, verified as `Boolean(j.verified)`, followers from `followers_count` **or** `followersCount` — both shapes observed) plus `profiles_public` by `kick_id`. sessionStorage cache, degrade to forum-only data on fetch failure.

**Conventions:** as plans 01–03.

---

### Task 1: Tenor mapper (TDD) + gif-search proxy

**Files:**
- Create: `src/lib/tenor.ts`
- Test: `src/lib/__tests__/tenor.test.ts`
- Create: `src/app/api/forum/gif-search/route.ts`

- [ ] **Step 1: Failing test** — `src/lib/__tests__/tenor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapTenorResults } from "../tenor";

const fixture = {
  results: [
    {
      id: "111",
      content_description: "happy chicken",
      media_formats: {
        gif: { url: "https://media.tenor.com/abc/full.gif", dims: [498, 280] },
        tinygif: { url: "https://media.tenor.com/abc/tiny.gif", dims: [220, 124] },
      },
    },
    { id: "222", media_formats: {} }, // no gif → dropped
    {
      id: "333",
      media_formats: { gif: { url: "https://media.tenor.com/x/g.gif", dims: [100, 100] } },
    }, // no tinygif → preview falls back to gif
  ],
};

describe("mapTenorResults", () => {
  it("maps results, drops gif-less rows, falls back preview to full gif", () => {
    const out = mapTenorResults(fixture);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: "111",
      preview: "https://media.tenor.com/abc/tiny.gif",
      url: "https://media.tenor.com/abc/full.gif",
      width: 498,
      height: 280,
      alt: "happy chicken",
    });
    expect(out[1].preview).toBe("https://media.tenor.com/x/g.gif");
    expect(out[1].alt).toBe("GIF");
  });
  it("tolerates garbage", () => {
    expect(mapTenorResults(null)).toEqual([]);
    expect(mapTenorResults({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — FAIL. Implement `src/lib/tenor.ts`:**

```ts
/* Tenor v2 response mapping (pure — unit-tested without an API key). */

export type GifResult = {
  id: string;
  preview: string;
  url: string;
  width: number;
  height: number;
  alt: string;
};

export function mapTenorResults(j: unknown): GifResult[] {
  const results = Array.isArray((j as { results?: unknown[] })?.results)
    ? ((j as { results: unknown[] }).results as Record<string, unknown>[])
    : [];
  return results.flatMap((rec) => {
    const mf = (rec.media_formats ?? {}) as Record<
      string,
      { url?: string; dims?: number[] } | undefined
    >;
    const gif = mf.gif ?? mf.mediumgif;
    const tiny = mf.tinygif ?? gif;
    if (!rec.id || !gif?.url) return [];
    return [
      {
        id: String(rec.id),
        preview: String(tiny?.url ?? gif.url),
        url: String(gif.url),
        width: Number(gif.dims?.[0] ?? 0) || 0,
        height: Number(gif.dims?.[1] ?? 0) || 0,
        alt: String(rec.content_description ?? "") || "GIF",
      },
    ];
  });
}

/** Only Tenor-hosted media may be stored as a comment gif_url. */
export function isTenorMediaUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return (
      url.protocol === "https:" &&
      (url.hostname === "media.tenor.com" || url.hostname.endsWith(".tenor.com")) &&
      u.length <= 500
    );
  } catch {
    return false;
  }
}
```

Add to the test file (same run):

```ts
import { isTenorMediaUrl } from "../tenor";

describe("isTenorMediaUrl", () => {
  it("accepts tenor media, rejects everything else", () => {
    expect(isTenorMediaUrl("https://media.tenor.com/abc/full.gif")).toBe(true);
    expect(isTenorMediaUrl("https://evil.com/x.gif")).toBe(false);
    expect(isTenorMediaUrl("http://media.tenor.com/abc.gif")).toBe(false);
    expect(isTenorMediaUrl("not a url")).toBe(false);
  });
});
```

- [ ] **Step 3: `src/app/api/forum/gif-search/route.ts`:**

```ts
import { type NextRequest } from "next/server";
import { jsonError } from "@/lib/forumApi";
import { mapTenorResults } from "@/lib/tenor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q=… → { results: GifResult[] }. Public read; the Tenor key stays here. */
export async function GET(req: NextRequest) {
  const key = process.env.TENOR_API_KEY;
  if (!key) {
    return jsonError(501, "not_configured", "GIF search isn't configured yet.");
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return jsonError(400, "bad_query", "Type something to search.");

  const url =
    `https://tenor.googleapis.com/v2/search?key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(q)}&limit=24&media_filter=gif,tinygif&contentfilter=medium` +
    `&client_key=chickenandy-forum`;
  let j: unknown;
  try {
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) return jsonError(502, "tenor_error", `Tenor answered ${r.status}.`);
    j = await r.json();
  } catch {
    return jsonError(502, "tenor_error", "Couldn't reach Tenor.");
  }
  return Response.json(
    { results: mapTenorResults(j) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
```

- [ ] **Step 4: Tests PASS + tsc clean → commit** (`Forum: Tenor gif-search proxy (mapper unit-tested, 501 w/o key)`)

---

### Task 2: GIF comments — API + picker + rendering

**Files:**
- Modify: `src/app/api/forum/comments/route.ts` (accept `gif_url`)
- Modify: `src/lib/forum.ts` (`createComment` gains `gifUrl`; add `searchGifs`)
- Create: `src/components/forum/GifPicker.tsx`
- Modify: `src/components/forum/CommentComposer.tsx` (GIF button + attach chip; gif-only allowed)
- Modify: `src/components/forum/CommentNode.tsx` (render `gif_url`)

- [ ] **Step 1: comments route** — imports `isTenorMediaUrl` from `@/lib/tenor`; parse `gif_url`; replace the body-required check and the RPC call:

```ts
  const gifUrl = typeof raw.gif_url === "string" ? raw.gif_url.trim() : "";
  if (gifUrl && !isTenorMediaUrl(gifUrl)) {
    return jsonError(400, "bad_gif", "GIFs must come from the Tenor picker.");
  }
  if ((!body && !gifUrl) || body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Comment must be 1-${MAX_BODY} characters (or a GIF).`);
  }
```

```ts
  const { data, error } = await admin.rpc("create_comment", {
    p_author: caller.profile.id,
    p_post: postId,
    p_parent: parentId,
    p_body: body || null,
    p_gif_url: gifUrl || null,
  });
```

(raw type gains `gif_url?: unknown`.)

- [ ] **Step 2: `forum.ts`** — extend `createComment` signature `(postId, parentId, body, gifUrl: string | null = null)` sending `gif_url: gifUrl`; add:

```ts
export async function searchGifs(q: string): Promise<
  { id: string; preview: string; url: string; width: number; height: number; alt: string }[]
> {
  const j = await forumFetch<{ results: { id: string; preview: string; url: string; width: number; height: number; alt: string }[] }>(
    `/api/forum/gif-search?q=${encodeURIComponent(q)}`,
  );
  return j.results;
}
```

- [ ] **Step 3: `GifPicker.tsx`:**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { searchGifs } from "@/lib/forum";

type Gif = { id: string; preview: string; url: string; width: number; height: number; alt: string };

export default function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: Gif) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setGifs(null);
      setError(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setError(null);
        setGifs(await searchGifs(q.trim()));
      } catch (e) {
        setGifs(null);
        setError((e as Error).message);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="mt-2 rounded-xl border border-line bg-elevated p-3 shadow-xl">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Tenor GIFs…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
        />
        <button type="button" onClick={onClose} className="text-xs font-semibold text-neutral-400 hover:text-neutral-200">
          Close
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-neutral-500">{error}</p>}
      {gifs !== null && gifs.length === 0 && !error && (
        <p className="mt-2 text-xs text-neutral-600">Nothing found.</p>
      )}
      {gifs && gifs.length > 0 && (
        <div className="mt-2 grid max-h-56 grid-cols-3 gap-1 overflow-y-auto">
          {gifs.map((g) => (
            <button key={g.id} type="button" onClick={() => onPick(g)} className="overflow-hidden rounded-md bg-black/40">
              <img src={g.preview} alt={g.alt} loading="lazy" className="h-20 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-right text-[10px] text-neutral-600">Powered by Tenor</p>
    </div>
  );
}
```

- [ ] **Step 4: `CommentComposer`** — state `gif` (`Gif | null`) + `showPicker`; submit enabled when `body.trim() || gif`; send `createComment(postId, parentId, text, gif?.url ?? null)`; UI between textarea and buttons: GIF button (left-aligned), attached-gif chip (preview img h-16 + ✕), `<GifPicker>` when open. On submit success also `setGif(null)`.
- [ ] **Step 5: `CommentNode`** — under the body paragraph render:

```tsx
{!c.removed && c.gif_url && (
  <img src={c.gif_url} alt="GIF" loading="lazy" className="mt-1.5 max-h-64 rounded-lg" />
)}
```

(also render when body is null — the block is independent of `c.body`.)

- [ ] **Step 6: gates + commit** (`Forum: GIF comments (Tenor picker, gif-only allowed, node rendering)`)

---

### Task 3: Hovercard data lib

**Files:**
- Create: `src/lib/hovercard.ts`

```ts
import { getSupabase } from "@/lib/supabase";

/* Hovercard data: keyless client-side Kick channel fetch (lib/kick.ts pattern,
   sessionStorage-cached) + forum stats from profiles_public. Every failure
   degrades to null — the card renders whatever half it has. */

export type KickLite = {
  avatar: string | null;
  verified: boolean;
  followers: number | null;
  joined: string | null; // ISO — chatroom.created_at tracks account creation
};

const TTL = 10 * 60_000;

export async function fetchKickLite(username: string): Promise<KickLite | null> {
  const key = `hover1:${username.toLowerCase()}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const { t, data } = JSON.parse(raw);
      if (Date.now() - t < TTL) return data as KickLite | null;
    }
  } catch {
    /* no cache */
  }
  let data: KickLite | null = null;
  try {
    const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(username.toLowerCase())}`, {
      mode: "cors",
      headers: { accept: "application/json" },
    });
    if (r.ok) {
      const j = (await r.json()) as Record<string, unknown>;
      const user = (j.user ?? {}) as Record<string, unknown>;
      const chatroom = (j.chatroom ?? {}) as Record<string, unknown>;
      const followers =
        typeof j.followers_count === "number"
          ? j.followers_count
          : typeof j.followersCount === "number"
            ? j.followersCount
            : null;
      data = {
        avatar: (user.profile_pic as string) || null,
        verified: Boolean(j.verified),
        followers,
        joined: (chatroom.created_at as string) || null,
      };
    }
  } catch {
    data = null;
  }
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* quota */
  }
  return data;
}

export type ForumStats = {
  postKarma: number;
  commentKarma: number;
  memberSince: string;
  role: "user" | "moderator" | "admin";
};

export async function fetchForumStats(kickId: number): Promise<ForumStats | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("profiles_public")
    .select("post_karma, comment_karma, created_at, role")
    .eq("kick_id", kickId)
    .maybeSingle();
  if (!data) return null;
  return {
    postKarma: data.post_karma as number,
    commentKarma: data.comment_karma as number,
    memberSince: data.created_at as string,
    role: data.role as ForumStats["role"],
  };
}

/** ISO → "Mar 2025" (en) — hidden entirely when the source field is absent. */
export function fmtMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
```

- [ ] Gates + commit (`Forum: hovercard data lib (kick lite fetch + forum stats)`)

---

### Task 4: `UserHovercard` + integration

**Files:**
- Create: `src/components/forum/UserHovercard.tsx`
- Modify: `src/components/forum/PostCard.tsx` (author name)
- Modify: `src/components/forum/CommentNode.tsx` (author name)

- [ ] **Step 1: component:**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { fetchForumStats, fetchKickLite, fmtMonthYear, type ForumStats, type KickLite } from "@/lib/hovercard";
import { fmtCount } from "@/lib/kick";
import { VerifiedBadge } from "@/components/ui";

/** Wraps a username; hover (300ms intent) or tap shows Kick + forum stats. */
export default function UserHovercard({
  username,
  kickId,
  children,
}: {
  username: string | null;
  kickId: number | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [kick, setKick] = useState<KickLite | null>(null);
  const [forum, setForum] = useState<ForumStats | null>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || loaded.current || !username) return;
    loaded.current = true;
    fetchKickLite(username).then(setKick).catch(() => {});
    if (kickId != null) fetchForumStats(kickId).then(setForum).catch(() => {});
  }, [open, username, kickId]);

  if (!username) return <>{children}</>;

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 300);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  const joined = fmtMonthYear(kick?.joined ?? null);
  const member = fmtMonthYear(forum?.memberSince ?? null);

  return (
    <span className="relative inline-block" onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" onClick={() => setOpen(!open)} className="cursor-pointer">
        {children}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-line bg-elevated p-3 text-left shadow-xl">
          <div className="flex items-center gap-2.5">
            {kick?.avatar ? (
              <img src={kick.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-bold text-neutral-300">
                {username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-bold text-neutral-100">
                {username}
                {kick?.verified && <VerifiedBadge />}
                {forum && forum.role !== "user" && (
                  <span className={`rounded px-1 py-px text-[9px] font-bold uppercase ${forum.role === "admin" ? "bg-accent/15 text-accent" : "bg-emerald-400/15 text-emerald-300"}`}>
                    {forum.role === "admin" ? "Admin" : "Mod"}
                  </span>
                )}
              </p>
              <a
                href={`https://kick.com/${encodeURIComponent(username.toLowerCase())}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-neutral-500 hover:text-accent"
              >
                kick.com/{username.toLowerCase()}
              </a>
            </div>
          </div>
          <div className="mt-2.5 space-y-1 text-xs text-neutral-400">
            <p>
              <span className="font-semibold text-neutral-200">{kick?.followers != null ? fmtCount(kick.followers) : "—"}</span> followers
              {joined && (
                <>
                  {" · "}on Kick since <span className="font-semibold text-neutral-200">{joined}</span>
                </>
              )}
            </p>
            {forum && (
              <p>
                <span className="font-semibold text-neutral-200">{forum.postKarma}</span> post karma ·{" "}
                <span className="font-semibold text-neutral-200">{forum.commentKarma}</span> comment karma
                {member && (
                  <>
                    {" · "}here since <span className="font-semibold text-neutral-200">{member}</span>
                  </>
                )}
              </p>
            )}
            {!kick && !forum && <p className="text-neutral-600">Loading…</p>}
          </div>
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 2: PostCard** — wrap the author span:

```tsx
<UserHovercard username={post.author_username} kickId={post.author_kick_id}>
  <span className="font-semibold text-neutral-300">u/{post.author_username}</span>
</UserHovercard>
```

- [ ] **Step 3: CommentNode** — wrap the non-removed username the same way (`username={c.author_username} kickId={c.author_kick_id}`; removed comments keep the plain "[removed]" span).
- [ ] **Step 4: gates + commit** (`Forum: Kick hovercards on every username (kick lite + forum stats)`)

---

### Task 5: Verify + docs + deploy + prod smoke

- [ ] Full gates (tests incl. new tenor suite, tsc, lint baseline, build).
- [ ] Browser E2E (user's Chrome on localhost, background-tab caveats from plan 03): hovercard on `u/TwizOG` (welcome post) shows real avatar/followers/"on Kick since Mar 2025" + admin badge + karma; GIF button shows picker; search shows the 501 "not configured" message gracefully (no key yet); gif-only comment path exercised by POSTing a comment with a `media.tenor.com` URL directly via API (validator accepts) and rendering in the thread; then delete that comment row (MCP) and decrement the count.
- [ ] Update `docs/forum-setup.md` with the `TENOR_API_KEY` step (Google Cloud → Tenor API key → `npx vercel env add TENOR_API_KEY production` + `.env.local`).
- [ ] Push; watch Pages; prod smoke: `/api/forum/gif-search?q=test` → 501 not_configured (until the key lands), hovercard fetches are client-side (no prod surface). Memory update.

## Self-review notes

- **Spec coverage (phase 5):** Tenor proxy + picker + gif comments (§6 gif-search, §7 GifPicker — gif-only comments honored by the existing DB CHECK), hovercards with the agreed "Kick fields only" content (§3 decision: avatar/verified/followers/join date, no invented level) + forum karma/role (§7 UserHovercard). Join date sourced from `chatroom.created_at` (confirmed present in the user's own channel payload; line hidden when absent per spec).
- **Type consistency:** `GifResult` shared by mapper/route/`searchGifs`/picker; `createComment`'s new 4th arg defaults to null (existing callers unchanged); `author_kick_id` flows from both views (plans 01–02) into the hovercard.
- **No placeholders:** all code complete; the single external dependency (`TENOR_API_KEY`) degrades explicitly (501 → picker message) and is a documented user step.
