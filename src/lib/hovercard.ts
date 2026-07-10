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
    const r = await fetch(
      `https://kick.com/api/v2/channels/${encodeURIComponent(username.toLowerCase())}`,
      { mode: "cors", headers: { accept: "application/json" } },
    );
    if (r.ok) {
      const j = (await r.json()) as Record<string, unknown>;
      const user = (j.user ?? {}) as Record<string, unknown>;
      const chatroom = (j.chatroom ?? {}) as Record<string, unknown>;
      const followers =
        typeof j.followers_count === "number"
          ? j.followers_count
          : typeof j.followersCount === "number"
            ? (j.followersCount as number)
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
