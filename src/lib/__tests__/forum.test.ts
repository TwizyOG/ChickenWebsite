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
