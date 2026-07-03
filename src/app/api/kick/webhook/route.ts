import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";

/* Kick webhook receiver.
   Kick POSTs signed events here (subscribe with the events:subscribe scope via
   POST https://api.kick.com/public/v1/events/subscriptions, method "webhook",
   url = <this route>). Every payload is signed:  {message_id}.{timestamp}.{body}
   with RSA-SHA256, verifiable against Kick's public key. We verify the signature,
   then dispatch by event type. Handlers just log by default (no DB in this app) —
   extend them to store/broadcast events. Runs on Vercel (Node runtime); it is
   stripped from the static GitHub Pages export. Spec: docs.kick.com/events. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fallback key from docs.kick.com/events/webhook-security; the live endpoint is
// preferred (keys can rotate) with this as a safety net.
const FALLBACK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

let cachedKey: string | null = null;
let cachedAt = 0;

async function getPublicKey(): Promise<string> {
  if (cachedKey && Date.now() - cachedAt < 3_600_000) return cachedKey;
  try {
    const r = await fetch("https://api.kick.com/public/v1/public-key");
    if (r.ok) {
      const j = (await r.json()) as { data?: { public_key?: string }; public_key?: string };
      const key = j?.data?.public_key ?? j?.public_key;
      if (key && key.includes("BEGIN PUBLIC KEY")) {
        cachedKey = key;
        cachedAt = Date.now();
        return key;
      }
    }
  } catch {
    /* fall through to fallback */
  }
  return FALLBACK_PUBLIC_KEY;
}

function verifySignature(
  pem: string,
  messageId: string,
  timestamp: string,
  rawBody: string,
  signatureB64: string,
): boolean {
  try {
    const signed = `${messageId}.${timestamp}.${rawBody}`;
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(signed);
    verifier.end();
    return verifier.verify(pem, signatureB64, "base64");
  } catch {
    return false;
  }
}

type KickEvent = Record<string, unknown>;

function handleEvent(type: string, event: KickEvent) {
  switch (type) {
    case "chat.message.sent": {
      const sender = (event.sender ?? {}) as { username?: string };
      console.info(`[kick-webhook] chat from ${sender.username}: ${String(event.content ?? "")}`);
      break;
    }
    case "channel.followed": {
      const follower = (event.follower ?? {}) as { username?: string };
      console.info(`[kick-webhook] new follower: ${follower.username}`);
      break;
    }
    case "channel.subscription.new":
    case "channel.subscription.renewal":
    case "channel.subscription.gifts": {
      console.info(`[kick-webhook] subscription event: ${type}`, JSON.stringify(event).slice(0, 300));
      break;
    }
    case "livestream.status.updated": {
      console.info(`[kick-webhook] livestream status:`, JSON.stringify(event).slice(0, 300));
      break;
    }
    default:
      console.info(`[kick-webhook] event ${type}`, JSON.stringify(event).slice(0, 300));
  }
  // Extend here: persist to a store, push to a websocket/SSE channel, etc.
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const h = req.headers;
  const messageId = h.get("Kick-Event-Message-Id") ?? h.get("Kick-Event-Message-ID") ?? "";
  const timestamp =
    h.get("Kick-Event-Message-Timestamp") ?? h.get("Kick-Event-Timestamp") ?? "";
  const signature = h.get("Kick-Event-Signature") ?? "";
  const eventType = h.get("Kick-Event-Type") ?? "unknown";

  if (!messageId || !timestamp || !signature) {
    return NextResponse.json({ error: "missing signature headers" }, { status: 400 });
  }

  const pem = await getPublicKey();
  if (!verifySignature(pem, messageId, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: KickEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    handleEvent(eventType, event);
  } catch (e) {
    console.error("[kick-webhook] handler error", e);
    // Still 200 so Kick doesn't retry a payload we've already accepted.
  }

  return NextResponse.json({ received: true });
}

// Lets you confirm the endpoint is live in a browser; Kick only uses POST.
export function GET() {
  return NextResponse.json({ ok: true, endpoint: "kick-webhook", accepts: "POST" });
}
