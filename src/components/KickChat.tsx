"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";

/* Kick chat rides on a public Pusher socket (same one kick.com's own web client
   uses). We resolve the channel's chatroom id, subscribe read-only, and render
   ChatMessageEvent payloads live — colors, emotes and badges included. If the
   socket can't establish, we fall back to Kick's official popout chat iframe so
   the panel always shows something. No auth, no sending: chat is read-only with
   a "sign in to chat" CTA, matching the source site. */

const PUSHER_KEY = "32cbd69e4b950bf97679"; // Kick's public Pusher app key (us2)
const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;
const MAX_MESSAGES = 120;

type Badge = { type: string; text?: string; count?: number };
type Msg = {
  id: string;
  username: string;
  color: string;
  badges: Badge[];
  content: string;
};

const EMOTE = /\[emote:(\d+):([^\]]+)\]/g;

function badgeStyle(type: string): { label: string; cls: string } | null {
  switch (type) {
    case "broadcaster":
      return { label: "HOST", cls: "bg-mature/90 text-white" };
    case "moderator":
      return { label: "MOD", cls: "bg-kick/20 text-kick" };
    case "vip":
      return { label: "VIP", cls: "bg-fuchsia-500/20 text-fuchsia-300" };
    case "og":
      return { label: "OG", cls: "bg-sky-500/20 text-sky-300" };
    case "founder":
      return { label: "FDR", cls: "bg-amber-500/20 text-amber-300" };
    case "subscriber":
    case "sub_gifter":
      return { label: "SUB", cls: "bg-accent/20 text-accent" };
    case "verified":
      return { label: "✓", cls: "bg-accent text-accent-ink" };
    case "staff":
      return { label: "STAFF", cls: "bg-emerald-500/20 text-emerald-300" };
    default:
      return null;
  }
}

function ChatLine({ m }: { m: Msg }) {
  const parts = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    EMOTE.lastIndex = 0;
    while ((match = EMOTE.exec(m.content))) {
      if (match.index > last) nodes.push(m.content.slice(last, match.index));
      const [, id, name] = match;
      nodes.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${m.id}-${match.index}`}
          src={`https://files.kick.com/emotes/${id}/fullsize`}
          alt={name}
          title={name}
          className="mx-0.5 inline-block h-5 w-5 align-text-bottom"
          loading="lazy"
        />,
      );
      last = match.index + match[0].length;
    }
    if (last < m.content.length) nodes.push(m.content.slice(last));
    return nodes;
  }, [m]);

  return (
    <div className="chat-line px-3 py-1 text-sm leading-snug">
      {m.badges.map((b, i) => {
        const s = badgeStyle(b.type);
        if (!s) return null;
        return (
          <span
            key={i}
            className={`mr-1 inline-block rounded px-1 py-px text-[9px] font-bold leading-none ${s.cls}`}
            title={b.text || b.type}
          >
            {s.label}
            {b.type === "subscriber" && b.count ? b.count : ""}
          </span>
        );
      })}
      <span className="font-semibold" style={{ color: m.color }}>
        {m.username}
      </span>
      <span className="text-faint">: </span>
      <span className="text-ink/90">
        {parts.map((p, i) => (
          <Fragment key={i}>{p}</Fragment>
        ))}
      </span>
    </div>
  );
}

export default function KickChat({ slug }: { slug: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [mode, setMode] = useState<"connecting" | "live" | "iframe">("connecting");
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    setMessages([]);
    setMode("connecting");
    let ws: WebSocket | null = null;
    let closed = false;
    const fallback = setTimeout(() => setMode((m) => (m === "connecting" ? "iframe" : m)), 7000);

    (async () => {
      try {
        const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
          mode: "cors",
          headers: { accept: "application/json" },
        });
        if (!r.ok) throw new Error(`channel ${r.status}`);
        const j = (await r.json()) as { chatroom?: { id?: number } };
        const chatroomId = j?.chatroom?.id;
        if (!chatroomId) throw new Error("no chatroom");
        if (closed) return;

        ws = new WebSocket(PUSHER_URL);
        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: { auth: "", channel: `chatrooms.${chatroomId}.v2` },
            }),
          );
        };
        ws.onmessage = (ev) => {
          let frame: { event?: string; data?: unknown };
          try {
            frame = JSON.parse(ev.data as string);
          } catch {
            return;
          }
          if (frame.event === "pusher:ping") {
            ws?.send(JSON.stringify({ event: "pusher:pong", data: {} }));
            return;
          }
          if (frame.event === "pusher_internal:subscription_succeeded") {
            clearTimeout(fallback);
            setMode("live");
            return;
          }
          if (frame.event === "App\\Events\\ChatMessageEvent") {
            let d: Record<string, unknown>;
            try {
              d = JSON.parse(frame.data as string);
            } catch {
              return;
            }
            const sender = (d.sender ?? {}) as Record<string, unknown>;
            const identity = (sender.identity ?? {}) as Record<string, unknown>;
            const badges = Array.isArray(identity.badges) ? (identity.badges as Badge[]) : [];
            const msg: Msg = {
              id: String(d.id ?? Math.random()),
              username: String(sender.username ?? "anon"),
              color: (identity.color as string) || "#e3b23c",
              badges,
              content: String(d.content ?? ""),
            };
            setMessages((prev) => {
              const next = [...prev, msg];
              return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
            });
          }
        };
        ws.onerror = () => setMode((m) => (m === "connecting" ? "iframe" : m));
        ws.onclose = () => {
          if (!closed) setMode((m) => (m === "connecting" ? "iframe" : m));
        };
      } catch {
        if (!closed) setMode("iframe");
      }
    })();

    return () => {
      closed = true;
      clearTimeout(fallback);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  }, [slug]);

  // autoscroll unless the user scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-panel">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold uppercase tracking-wide">Stream Chat</span>
          <span
            className={`h-2 w-2 rounded-full ${
              mode === "live" ? "bg-kick live-dot" : mode === "connecting" ? "bg-accent" : "bg-faint"
            }`}
          />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">
          via ChickenAndy
        </span>
      </header>

      {mode === "iframe" ? (
        <iframe
          key={slug}
          src={`https://kick.com/popout/${encodeURIComponent(slug)}/chat`}
          title={`${slug} chat`}
          className="min-h-0 flex-1 w-full rounded-b-2xl bg-black"
        />
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="min-h-0 flex-1 overflow-y-auto py-2"
          >
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-faint">
                {mode === "connecting" ? "Connecting to live chat…" : "Waiting for messages…"}
              </div>
            ) : (
              messages.map((m) => <ChatLine key={m.id} m={m} />)
            )}
          </div>
          <div className="border-t border-line p-3">
            <a
              href="/login"
              className="block rounded-lg border border-accent/40 py-2.5 text-center text-sm font-semibold uppercase tracking-wide text-accent transition hover:bg-accent/10"
            >
              Sign in to chat
            </a>
          </div>
        </>
      )}
    </section>
  );
}
