import { NextResponse, type NextRequest } from "next/server";
import { FORUM_SESSION_COOKIE, FORUM_SESSION_MAX_AGE, signForumSession } from "@/lib/forumSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/* Kick OAuth callback — exchanges the auth code for tokens server-side (the
   client secret never reaches the browser), fetches the user's name, and sets
   an httpOnly session cookie. Requires env: NEXT_PUBLIC_KICK_CLIENT_ID and
   KICK_CLIENT_SECRET (set in Vercel). This route makes the app non-static, so
   it is stripped from the GitHub Pages static-export build. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How long a signed-in session may live (rolling — extended on each refresh).
// The short-lived access token is renewed silently within this window, so the
// user stays signed in until they explicitly log out.
const SESSION_MAX = 60 * 60 * 24 * 60; // 60 days

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

  let token: { access_token?: string; expires_in?: number; refresh_token?: string } = {};
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

  // best-effort: fetch the signed-in user's identity. The numeric user_id is
  // the stable anchor the forum profile hangs off (usernames can change).
  let username = "Kick user";
  let kickId: number | null = null;
  let avatar: string | null = null;
  try {
    const ur = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (ur.ok) {
      const uj = await ur.json();
      const u = uj?.data?.[0] ?? {};
      username = u.name || u.username || username;
      const rawId = Number(u.user_id);
      kickId = Number.isFinite(rawId) && rawId > 0 ? rawId : null;
      avatar = typeof u.profile_picture === "string" && u.profile_picture ? u.profile_picture : null;
    }
  } catch {
    /* keep defaults */
  }

  const accessMax = token.expires_in ?? 3600;
  const res = NextResponse.redirect(`${base}/`);
  res.cookies.set("kick_token", token.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: accessMax,
  });
  // Long-lived rotating refresh token → the session is renewed silently, so it
  // stays alive until the user explicitly logs out (see the refresh route +
  // KickSessionKeeper). httpOnly: never exposed to page scripts.
  if (token.refresh_token) {
    res.cookies.set("kick_refresh", token.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX,
    });
  }
  // Readable display-name cookie the UI reads to know it's signed in — kept for
  // the whole session window (not just the ~1h access-token life) so the header
  // and chat don't flip to "signed out" between token refreshes.
  res.cookies.set("kick_user", username, {
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX,
  });
  // Forum identity: signed session cookie + profile upsert (spec:
  // docs/superpowers/specs/2026-07-05-community-forum-design.md §4.1).
  const forumSecret = process.env.FORUM_SESSION_SECRET ?? "";
  if (kickId && forumSecret) {
    res.cookies.set(FORUM_SESSION_COOKIE, signForumSession({ kickId, username, avatar }, forumSecret), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: FORUM_SESSION_MAX_AGE,
    });
    try {
      const admin = getSupabaseAdmin();
      if (admin) {
        const adminIds = (process.env.FORUM_ADMIN_KICK_IDS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const { data: existing } = await admin
          .from("profiles")
          .select("role")
          .eq("kick_id", kickId)
          .maybeSingle();
        // allowlist promotes to admin; otherwise keep whatever role the row has
        const role = adminIds.includes(String(kickId)) ? "admin" : existing?.role ?? "user";
        await admin
          .from("profiles")
          .upsert({ kick_id: kickId, username, avatar_url: avatar, role }, { onConflict: "kick_id" });
      }
    } catch {
      /* profile syncs on a later login — never block sign-in on the forum DB */
    }
  }
  res.cookies.delete("kick_pkce");
  res.cookies.delete("kick_state");
  return res;
}
