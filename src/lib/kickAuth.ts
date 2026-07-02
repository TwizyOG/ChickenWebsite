/* Kick OAuth 2.1 (authorization code + PKCE) — client side.
   Endpoints + scopes per Kick docs (docs.kick.com, via Context7):
     authorize: https://id.kick.com/oauth/authorize
     token:     https://id.kick.com/oauth/token  (exchanged server-side — needs secret)
   The token exchange requires the client secret, so it happens in the serverless
   route /api/auth/kick/callback; this file only builds the PKCE redirect. */

export const KICK_AUTHORIZE = "https://id.kick.com/oauth/authorize";
export const KICK_SCOPES = "user:read channel:read events:subscribe";

export const KICK_CLIENT_ID = process.env.NEXT_PUBLIC_KICK_CLIENT_ID ?? "";

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(len = 64): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return base64url(a).slice(0, len);
}

async function challengeFrom(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Kick login is only wired when a client id is configured (NEXT_PUBLIC_KICK_CLIENT_ID). */
export const kickLoginConfigured = () => KICK_CLIENT_ID.length > 0;

export async function startKickLogin(): Promise<void> {
  if (!kickLoginConfigured()) return;
  const verifier = randomToken(64);
  const state = randomToken(24);
  const challenge = await challengeFrom(verifier);
  // short-lived, readable by the callback route
  document.cookie = `kick_pkce=${verifier}; path=/; max-age=600; samesite=lax`;
  document.cookie = `kick_state=${state}; path=/; max-age=600; samesite=lax`;
  const redirectUri = `${location.origin}/api/auth/kick/callback`;
  const url =
    `${KICK_AUTHORIZE}?response_type=code` +
    `&client_id=${encodeURIComponent(KICK_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(KICK_SCOPES)}` +
    `&code_challenge=${challenge}&code_challenge_method=S256` +
    `&state=${state}`;
  location.href = url;
}

/** Reads the readable `kick_user` cookie set by the callback route (client). */
export function currentKickUser(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)kick_user=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
