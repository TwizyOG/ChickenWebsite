import { NextResponse, type NextRequest } from "next/server";
import { introspectKickToken } from "@/lib/kickToken";

/* Auth diagnostic — open this in a signed-in tab to see EXACTLY what the Kick
   OAuth token grants, and (optionally) to capture Kick's verbatim response to a
   real chat send so we can name the true cause of a 403.

     GET /api/kick/debug            → token scopes (does it include chat:write?)
     GET /api/kick/debug?to=<slug>  → also POST a one-off test message to <slug>
                                       and return Kick's raw status + body.

   Only ever acts on the caller's own token (their httpOnly cookie); no secrets
   are returned. The ?to= send is explicit and off by default so nothing posts
   unless asked. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveBroadcasterId(slug: string, token: string) {
  const r = await fetch(
    `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  const body = await r.json().catch(() => ({}));
  const id = (body as { data?: { broadcaster_user_id?: number }[] })?.data?.[0]?.broadcaster_user_id;
  return { ok: r.ok, status: r.status, id: typeof id === "number" ? id : null, body };
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("kick_token")?.value;
  const signedInAs = req.cookies.get("kick_user")?.value ?? null;
  if (!token) {
    return NextResponse.json(
      { signedIn: false, hint: "No kick_token cookie — sign in with Kick first." },
      { status: 401 },
    );
  }

  const info = await introspectKickToken(token);
  const base = info.ok
    ? {
        signedInAs,
        active: info.active,
        tokenType: info.tokenType,
        scopes: info.scopes,
        hasChatWrite: info.scopes.includes("chat:write"),
        expiresAt: info.exp ? new Date(info.exp * 1000).toISOString() : null,
      }
    : { signedInAs, introspection: "failed", status: info.status };

  const to = req.nextUrl.searchParams.get("to");
  if (!to) return NextResponse.json(base);

  // Live send-test: capture Kick's verbatim response so a 403's real reason
  // (channel restriction, unverified account, ban, …) is visible.
  const resolved = await resolveBroadcasterId(to.trim(), token);
  if (!resolved.id) {
    return NextResponse.json({ ...base, sendTest: { to, resolveStatus: resolved.status, resolvedId: null } });
  }

  const sr = await fetch("https://api.kick.com/public/v1/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      broadcaster_user_id: resolved.id,
      content: "chat connectivity test — please ignore",
      type: "user",
    }),
  });
  const kickBody = await sr.json().catch(() => ({}));

  return NextResponse.json({
    ...base,
    sendTest: {
      to,
      resolvedBroadcasterId: resolved.id,
      kickStatus: sr.status,
      kickOk: sr.ok,
      kickBody, // Kick's verbatim response — the real reason on failure
    },
  });
}
