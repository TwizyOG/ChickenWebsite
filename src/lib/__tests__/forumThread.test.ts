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
