import { NextResponse, type NextRequest } from "next/server";
import { introspectKickToken } from "@/lib/kickToken";

/* Auth diagnostic — open this in a signed-in tab to see EXACTLY what the Kick
   OAuth token actually grants. It introspects the httpOnly `kick_token` cookie
   against Kick's own introspection endpoint and reports the granted scopes, so
   we can tell whether chat sending fails because `chat:write` was never granted
   (vs. a channel-level or transient error). Only ever reveals the caller's own
   token info (their cookie); no secrets are returned. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (!info.ok) {
    return NextResponse.json(
      { signedInAs, introspection: "failed", status: info.status },
      { status: 502 },
    );
  }

  const scopes = info.scopes;
  return NextResponse.json({
    signedInAs,
    active: info.active,
    tokenType: info.tokenType,
    scopes,
    hasChatWrite: scopes.includes("chat:write"),
    expiresAt: info.exp ? new Date(info.exp * 1000).toISOString() : null,
  });
}
