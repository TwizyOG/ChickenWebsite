import { NextResponse, type NextRequest } from "next/server";

/* Kick OAuth callback — exchanges the auth code for tokens server-side (the
   client secret never reaches the browser), fetches the user's name, and sets
   an httpOnly session cookie. Requires env: NEXT_PUBLIC_KICK_CLIENT_ID and
   KICK_CLIENT_SECRET (set in Vercel). This route makes the app non-static, so
   it is stripped from the GitHub Pages static-export build. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("kick_state")?.value;
  const verifier = req.cookies.get("kick_pkce")?.value;

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${base}/login?error=${url.searchParams.get("error")}`);
  }
  if (!code || !verifier || !state || state !== cookieState) {
    return NextResponse.redirect(`${base}/login?error=invalid_state`);
  }

  const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID ?? "";
  const clientSecret = process.env.KICK_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/login?error=not_configured`);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${base}/api/auth/kick/callback`,
    code_verifier: verifier,
    code,
  });

  let token: { access_token?: string; expires_in?: number } = {};
  try {
    const r = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) return NextResponse.redirect(`${base}/login?error=token_${r.status}`);
    token = await r.json();
  } catch {
    return NextResponse.redirect(`${base}/login?error=token_network`);
  }
  if (!token.access_token) return NextResponse.redirect(`${base}/login?error=no_token`);

  // best-effort: fetch the signed-in user's display name
  let username = "Kick user";
  try {
    const ur = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (ur.ok) {
      const uj = await ur.json();
      username = uj?.data?.[0]?.name || uj?.data?.[0]?.username || username;
    }
  } catch {
    /* keep default */
  }

  const maxAge = token.expires_in ?? 3600;
  const res = NextResponse.redirect(`${base}/`);
  res.cookies.set("kick_token", token.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  res.cookies.set("kick_user", username, {
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  res.cookies.delete("kick_pkce");
  res.cookies.delete("kick_state");
  return res;
}
