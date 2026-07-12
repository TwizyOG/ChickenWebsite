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
      default:
        return item(n, "account", "Forum notification", title ?? excerpt, href);
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
