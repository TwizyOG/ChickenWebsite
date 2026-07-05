"use client";

import { useEffect, useState } from "react";
import { currentKickUser, kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { addNotice } from "@/lib/notifications";

/* Connected Accounts page body — mirrors chickenandy.vercel.app/account/connected.
   Kick is a real connection (existing OAuth flow, also used by stream chat);
   the other platforms are "coming soon" exactly like the live site. Icon tiles
   carry each platform's brand color, glyphs extracted from the live page. */

const BRAND: Record<string, string> = {
  Kick: "#53fc18",
  Twitch: "#9146ff",
  YouTube: "#ff0000",
  Discord: "#5865f2",
  "Twitter / X": "#e7e9ea",
  Instagram: "#e1306c",
};

function KickGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M3 3h6v5h2V6h2V4h6v6h-2v2h-2v2h2v2h2v6h-6v-2h-2v-2H9v6H3V3z" />
    </svg>
  );
}

const SOON_PROVIDERS: { name: string; desc: string; icon: React.ReactNode }[] = [
  {
    name: "Twitch",
    desc: "Link your Twitch channel.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M4.3 3L3 6.2v12.3h4.2V21l3.3-2.5h2.6L19 13V3H4.3zm13.1 9.4l-2.7 2.7h-4.2l-2.3 1.7v-1.7H4.6V4.5h12.8v7.9zM14.7 7.2h-1.5v4.6h1.5V7.2zm-4.3 0H8.9v4.6h1.5V7.2z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    desc: "Link your YouTube channel.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M23 7.5a3 3 0 00-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 001 7.5 31 31 0 001 12a31 31 0 00.1 4.5 3 3 0 002.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 002.1-2.1A31 31 0 0023 12a31 31 0 00-.1-4.5zM10 15V9l5 3z" />
      </svg>
    ),
  },
  {
    name: "Discord",
    desc: "Link your Discord to join the community.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M19.3 5.3A16 16 0 0015.4 4l-.2.4a12 12 0 013.5 1.8 13.8 13.8 0 00-13.4 0A12 12 0 018.8 4.4L8.6 4a16 16 0 00-3.9 1.3A18.6 18.6 0 001.3 18a16.2 16.2 0 005 2.5l.6-1.2a10.6 10.6 0 01-1.6-.8l.4-.3a9.9 9.9 0 008.6 0l.4.3a10.6 10.6 0 01-1.6.8l.6 1.2a16.2 16.2 0 005-2.5 18.6 18.6 0 00-3.4-12.7zM8.9 14.6c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9zm6.2 0c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9z" />
      </svg>
    ),
  },
  {
    name: "Twitter / X",
    desc: "Link your X profile.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M18.2 2H21l-6.5 7.4L22 22h-6l-4.7-6.1L5.9 22H3l7-8L2 2h6.2l4.2 5.6L18.2 2zm-2.1 18h1.6L7 4H5.3l10.8 16z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    desc: "Link your Instagram profile.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

function Row({
  icon,
  brand,
  name,
  soon,
  desc,
  action,
}: {
  icon: React.ReactNode;
  brand: string;
  name: string;
  soon?: boolean;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-elevated"
        style={{ color: brand }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-ink">{name}</h2>
          {soon && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-faint">
              Coming soon
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-faint sm:whitespace-normal">{desc}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export default function AccountConnected() {
  const [kickUser, setKickUser] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const user = currentKickUser();
    setKickUser(user);
    setConfigured(kickLoginConfigured());
    // One "connected" notice per Kick account.
    if (user) {
      try {
        const KEY = "ca:kick-connect-noticed";
        if (localStorage.getItem(KEY) !== user) {
          addNotice("account", `Kick account connected as ${user}`);
          localStorage.setItem(KEY, user);
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-dim">
        Connect your streaming or social accounts to unlock more features.
      </p>

      <Row
        icon={<KickGlyph />}
        brand={BRAND.Kick}
        name="Kick"
        desc="Connect your Kick account to verify your identity and chat from the site."
        action={
          kickUser ? (
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-kick/40 bg-kick/10 px-2.5 py-1 text-[11px] font-bold text-kick sm:inline">
                Connected as {kickUser}
              </span>
              <a
                href="/api/auth/kick/logout"
                className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-dim transition hover:text-mature"
              >
                Disconnect
              </a>
            </div>
          ) : (
            <button
              type="button"
              disabled={!configured || busy}
              onClick={() => {
                setBusy(true);
                startKickLogin();
              }}
              title={
                configured ? undefined : "Kick sign-in isn’t configured in this deployment."
              }
              className="rounded-lg bg-kick px-4 py-2 text-xs font-bold uppercase tracking-wide text-black transition hover:brightness-95 disabled:opacity-50"
            >
              {busy ? "Redirecting…" : "Connect"}
            </button>
          )
        }
      />

      {SOON_PROVIDERS.map((p) => (
        <Row
          key={p.name}
          icon={p.icon}
          brand={BRAND[p.name]}
          name={p.name}
          soon
          desc={p.desc}
          action={
            <button
              type="button"
              disabled
              className="rounded-lg border border-line px-4 py-2 text-xs font-bold uppercase tracking-wide text-faint opacity-70"
            >
              Soon
            </button>
          }
        />
      ))}
    </div>
  );
}
