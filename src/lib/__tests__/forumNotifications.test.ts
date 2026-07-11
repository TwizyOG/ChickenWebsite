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
