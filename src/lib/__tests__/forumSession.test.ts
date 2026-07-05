import { describe, expect, it } from "vitest";
import {
  FORUM_SESSION_MAX_AGE,
  signForumSession,
  verifyForumSession,
} from "../forumSession";

const SECRET = "test-secret";
const USER = { kickId: 123456, username: "chickenandy", avatar: null };

describe("forumSession", () => {
  it("round-trips a valid session", () => {
    const token = signForumSession(USER, SECRET);
    const s = verifyForumSession(token, SECRET);
    expect(s?.kickId).toBe(123456);
    expect(s?.username).toBe("chickenandy");
    expect(s?.avatar).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signForumSession(USER, SECRET);
    const [body, mac] = token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const forged = Buffer.from(JSON.stringify({ ...payload, kickId: 999 })).toString("base64url");
    expect(verifyForumSession(`${forged}.${mac}`, SECRET)).toBeNull();
  });

  it("rejects the wrong secret", () => {
    expect(verifyForumSession(signForumSession(USER, "other-secret"), SECRET)).toBeNull();
  });

  it("rejects an expired session", () => {
    const past = Date.now() - (FORUM_SESSION_MAX_AGE + 60) * 1000;
    const token = signForumSession(USER, SECRET, past);
    expect(verifyForumSession(token, SECRET)).toBeNull();
  });

  it("rejects garbage tokens", () => {
    expect(verifyForumSession(undefined, SECRET)).toBeNull();
    expect(verifyForumSession("", SECRET)).toBeNull();
    expect(verifyForumSession("not-a-token", SECRET)).toBeNull();
    expect(verifyForumSession("a.b", SECRET)).toBeNull();
  });
});
