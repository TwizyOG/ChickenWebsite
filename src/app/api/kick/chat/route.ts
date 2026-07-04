import { NextResponse, type NextRequest } from "next/server";
import { introspectKickToken } from "@/lib/kickToken";

/* Send a chat message as the signed-in Kick user. Uses the httpOnly kick_token
   (needs the chat:write scope). Resolves the channel's broadcaster_user_id from
   its slug via the official channels API, then POSTs to /public/v1/chat.
   Spec: docs.kick.com/apis/chat (via Context7). Vercel-only (serverless). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idCache = new Map<string, number>();

async function resolveBroadcasterId(slug: string, token: string): Promise<number | null> {
  const key = slug.toLowerCase();
  const cached = idCache.get(key);
  if (cached) return cached;
  try {
    const r = await fetch(
      `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { broadcaster_user_id?: number }[] };
    const id = j?.data?.[0]?.broadcaster_user_id;
    if (typeof id === "number") {
      idCache.set(key, id);
      return id;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("kick_token")?.value;
  if (!token) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  let body: { slug?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const slug = (body.slug || "").trim();
  const content = (body.content || "").trim().slice(0, 500);
  if (!slug || !content) return NextResponse.json({ error: "empty" }, { status: 400 });

  const broadcasterId = await resolveBroadcasterId(slug, token);
  if (!broadcasterId) return NextResponse.json({ error: "channel_not_found" }, { status: 404 });

  try {
    const r = await fetch("https://api.kick.com/public/v1/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ broadcaster_user_id: broadcasterId, content, type: "user" }),
    });
    const j = (await r.json().catch(() => ({}))) as { message?: string; data?: unknown };

    if (r.ok) return NextResponse.json({ sent: true, data: j?.data });

    // A 403 is ambiguous: it can mean the token was never granted chat:write,
    // OR the channel rejected the message (followers/subs-only, slow mode, a
    // ban, etc.). Introspect the token to tell these apart instead of blindly
    // telling the user to re-auth — re-auth won't fix a channel restriction.
    if (r.status === 403) {
      const info = await introspectKickToken(token);
      if (info.ok && !info.scopes.includes("chat:write")) {
        return NextResponse.json(
          { error: "chat_scope_missing", scopes: info.scopes },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: "forbidden", detail: j?.message || "Channel rejected the message." },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: "send_failed", detail: j?.message }, { status: r.status });
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
