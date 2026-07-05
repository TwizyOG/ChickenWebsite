import { createHmac, timingSafeEqual } from "node:crypto";

/* Signed forum session — proves the caller's Kick identity to the forum write
   routes without a per-request Kick API call or a DB session table.
   Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(body)).
   Minted by the Kick OAuth callback, cleared by logout. The cookie only
   carries identity — role and ban status are loaded from the DB per write. */

export const FORUM_SESSION_COOKIE = "forum_session";
export const FORUM_SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 days, matches kick_refresh

export type ForumSession = {
  kickId: number;
  username: string;
  avatar: string | null;
  iat: number; // seconds since epoch
  exp: number;
};

function hmac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

export function signForumSession(
  user: { kickId: number; username: string; avatar: string | null },
  secret: string,
  nowMs = Date.now(),
): string {
  const iat = Math.floor(nowMs / 1000);
  const payload: ForumSession = { ...user, iat, exp: iat + FORUM_SESSION_MAX_AGE };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret).toString("base64url")}`;
}

export function verifyForumSession(
  token: string | undefined,
  secret: string,
  nowMs = Date.now(),
): ForumSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = hmac(body, secret);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  let payload: ForumSession;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload?.kickId !== "number" || typeof payload?.exp !== "number") return null;
  if (typeof payload.username !== "string") return null;
  if (payload.exp <= Math.floor(nowMs / 1000)) return null;
  return payload;
}
