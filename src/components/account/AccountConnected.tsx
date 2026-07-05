"use client";

import { useEffect, useState } from "react";
import { currentKickUser, kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { addNotice } from "@/lib/notifications";

/* Connected Accounts page body — mirrors chickenandy.vercel.app/account/connected.
   Kick is a real connection (existing OAuth flow, also used by stream chat);
   the other platforms are "coming soon" exactly like the live site. */

const SOON_PROVIDERS: { name: string; desc: string; icon: React.ReactNode }[] = [
  {
    name: "Twitch",
    desc: "Link your Twitch channel.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M4 2 2.5 5.5V19H7v3h3l3-3h4l4.5-4.5V2zm15 11.8L16.5 16H12l-2.6 2.6V16H5.5V4H19zM15 7h2v5h-2zm-5 0h2v5h-2z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    desc: "Link your YouTube channel.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.8 12 4.8 12 4.8s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 4.8 2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-4.8zM9.8 15.3V8.7L15.7 12z" />
      </svg>
    ),
  },
  {
    name: "Discord",
    desc: "Link your Discord to join the community.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M19.3 5.3A17 17 0 0 0 15.1 4l-.5 1a15.7 15.7 0 0 0-5.2 0L8.9 4a17 17 0 0 0-4.2 1.3C2 9.2 1.3 13 1.6 16.7A17.2 17.2 0 0 0 6.9 19l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 10.6 0l.4.3c-.5.3-1.1.6-1.7.8L17.1 19a17.2 17.2 0 0 0 5.3-2.3c.4-4.4-.7-8.1-3.1-11.4M8.7 14.4c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.9 2.1-1.9 2.1m6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1" />
      </svg>
    ),
  },
  {
    name: "Twitter / X",
    desc: "Link your X profile.",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9zm-1.1 16.1h1.7L7.5 4.8H5.7z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    desc: "Link your Instagram profile.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

function Row({
  icon,
  iconClass,
  name,
  soon,
  desc,
  action,
}: {
  icon: React.ReactNode;
  iconClass: string;
  name: string;
  soon?: boolean;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconClass}`}>
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
        icon={
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M3 3h5v6l4-6h6l-6 9 6 9h-6l-4-6v6H3z" />
          </svg>
        }
        iconClass="bg-kick/15 text-kick"
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
          iconClass="bg-elevated text-dim"
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
