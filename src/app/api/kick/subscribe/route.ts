import { NextResponse, type NextRequest } from "next/server";

/* Subscribe the signed-in user's channel to Kick webhook events. Uses the
   httpOnly `kick_token` cookie set at login (needs the events:subscribe scope);
   broadcaster is inferred from the token. Kick delivers matching events to the
   app's configured webhook URL → /api/kick/webhook.
     GET    → list current subscriptions
     POST   → subscribe to the default event set
     DELETE → remove all current subscriptions
   Spec: docs.kick.com/events/subscribe-to-events (via Context7). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.kick.com/public/v1/events/subscriptions";

const EVENTS = [
  { name: "chat.message.sent", version: 1 },
  { name: "channel.followed", version: 1 },
  { name: "channel.subscription.new", version: 1 },
  { name: "channel.subscription.renewal", version: 1 },
  { name: "channel.subscription.gifts", version: 1 },
  { name: "livestream.status.updated", version: 1 },
];

const tokenOf = (req: NextRequest) => req.cookies.get("kick_token")?.value;

export async function GET(req: NextRequest) {
  const token = tokenOf(req);
  if (!token) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  try {
    const r = await fetch(API, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json(j, { status: r.status });
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const token = tokenOf(req);
  if (!token) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ method: "webhook", events: EVENTS }),
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json(j, { status: r.status });
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = tokenOf(req);
  if (!token) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  try {
    const lr = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
    const lj = (await lr.json().catch(() => ({}))) as { data?: { id?: string }[] };
    const ids = (lj.data ?? []).map((s) => s.id).filter(Boolean) as string[];
    if (ids.length === 0) return NextResponse.json({ deleted: 0 });
    const qs = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&");
    const dr = await fetch(`${API}?${qs}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json({ deleted: ids.length }, { status: dr.ok ? 200 : dr.status });
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
