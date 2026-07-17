import { describe, expect, it } from "vitest";
import { buildTree, filterTree, sortTree, type ThreadComment } from "../forum";

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

  it("best breaks score ties oldest-first; old sorts by age ascending", () => {
    const rows = [
      c("a", null, { score: 3, created_at: "2026-07-06T00:00:02.000Z" }),
      c("b", null, { score: 3, created_at: "2026-07-06T00:00:01.000Z" }),
      c("d", null, { score: 9, created_at: "2026-07-06T00:00:03.000Z" }),
    ];
    expect(sortTree(buildTree(rows), "best").map((n) => n.comment.id)).toEqual(["d", "b", "a"]);
    expect(sortTree(buildTree(rows), "old").map((n) => n.comment.id)).toEqual(["b", "a", "d"]);
  });

  it("controversial ranks busy near-zero threads above high-score ones", () => {
    const rows = [
      c("hi", null, { score: 40 }), // popular, no discussion
      c("hot", null, { score: 0 }), // neutral with a pile of replies
      c("r1", "hot"),
      c("r2", "hot"),
      c("r3", "hot"),
    ];
    const out = sortTree(buildTree(rows), "controversial");
    expect(out[0].comment.id).toBe("hot");
  });

  it("qa bubbles threads the post author replied in, keeping best order otherwise", () => {
    const rows = [
      c("a", null, { score: 9 }),
      c("b", null, { score: 5 }),
      c("op-reply", "b", { author_kick_id: 777 }),
      c("z", null, { score: 7 }),
    ];
    const out = sortTree(buildTree(rows), "qa", 777);
    expect(out.map((n) => n.comment.id)).toEqual(["b", "a", "z"]);
    // Without the author id it falls back to plain best order.
    expect(sortTree(buildTree(rows), "qa").map((n) => n.comment.id)).toEqual(["a", "z", "b"]);
  });
});

describe("filterTree (comment search)", () => {
  const rows = [
    c("a", null, { body: "alpha talk" }),
    c("b", "a", { body: "unrelated" }),
    c("d", "b", { body: "needle in here" }),
    c("e", null, { body: "nothing" }),
    c("f", null, { body: null, author_username: "NeedleUser" }),
  ];
  it("keeps matches, their ancestors, and matches by author name", () => {
    const out = filterTree(buildTree(rows), "needle");
    expect(out.map((n) => n.comment.id)).toEqual(["a", "f"]);
    expect(out[0].children[0].comment.id).toBe("b"); // ancestor of the match
    expect(out[0].children[0].children[0].comment.id).toBe("d");
  });
  it("is a no-op for blank queries and prunes everything on no match", () => {
    expect(filterTree(buildTree(rows), "  ").length).toBe(3);
    expect(filterTree(buildTree(rows), "zzz").length).toBe(0);
  });
});
