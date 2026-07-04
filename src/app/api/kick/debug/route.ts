import { NextResponse, type NextRequest } from "next/server";
import { introspectKickToken } from "@/lib/kickToken";

/* Auth diagnostic (read-only) — open this in a signed-in tab to see EXACTLY
   what the Kick OAuth token grants, so a chat 403 can be attributed correctly
   (missing chat:write vs. a channel restriction). Only ever reports the
   caller's own token info (their httpOnly cookie); no secrets, no side effects. */

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

  return NextResponse.json({
    signedInAs,
    active: info.active,
    tokenType: info.tokenType,
    scopes: info.scopes,
    hasChatWrite: info.scopes.includes("chat:write"),
    expiresAt: info.exp ? new Date(info.exp * 1000).toISOString() : null,
  });
}
