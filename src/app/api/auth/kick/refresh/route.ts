import { NextResponse, type NextRequest } from "next/server";

/* Silent session renewal. Kick access tokens are short-lived (~1h) and rotate;
   this swaps the long-lived refresh cookie for a fresh access token (and a new
   rotated refresh token) so the user stays signed in until they explicitly log
   out. Called by KickSessionKeeper on load and on an interval.

   - no refresh cookie  → 401 no_refresh (old/pre-refresh session or signed out);
     the current session is left untouched.
   - Kick rejects it    → 401 refresh_failed + all auth cookies cleared (the
     refresh token is genuinely expired/revoked → real logout).
   - success            → new access + rotated refresh, session window rolled. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MAX = 60 * 60 * 24 * 60; // 60 days (matches the callback)
const secureCookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get("kick_refresh")?.value;
  if (!refresh) return NextResponse.json({ error: "no_refresh" }, { status: 401 });

  const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID ?? "";
  const clientSecret = process.env.KICK_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
  });

  let r: Response;
  try {
    r = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    // Transient network error — keep the session; the client retries next tick.
    return NextResponse.json({ error: "network" }, { status: 502 });
  }

  if (!r.ok) {
    // The refresh token itself was rejected → genuinely logged out. Clear all.
    const res = NextResponse.json({ error: "refresh_failed" }, { status: 401 });
    res.cookies.delete("kick_token");
    res.cookies.delete("kick_refresh");
    res.cookies.delete("kick_user");
    return res;
  }

  const token = (await r.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!token.access_token) {
    return NextResponse.json({ error: "no_token" }, { status: 502 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("kick_token", token.access_token, {
    ...secureCookie,
    maxAge: token.expires_in ?? 3600,
  });
  // Rotation: Kick returns a new refresh token each time — store it.
  if (token.refresh_token) {
    res.cookies.set("kick_refresh", token.refresh_token, { ...secureCookie, maxAge: SESSION_MAX });
  }
  // Roll the readable session cookie forward so active users never lapse.
  const user = req.cookies.get("kick_user")?.value;
  if (user) {
    res.cookies.set("kick_user", user, {
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX,
    });
  }
  return res;
}
