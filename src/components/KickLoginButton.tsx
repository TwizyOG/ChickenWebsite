"use client";

import { useEffect, useState } from "react";
import { startKickLogin, kickLoginConfigured, currentKickUser } from "@/lib/kickAuth";

export default function KickLoginButton() {
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConfigured(kickLoginConfigured());
    setUser(currentKickUser());
  }, []);

  if (user) {
    return (
      <div className="rounded-lg border border-kick/30 bg-kick/10 p-4 text-center">
        <p className="text-sm text-ink">
          Signed in as <span className="font-semibold text-kick">{user}</span>
        </p>
        <a
          href="/api/auth/kick/logout"
          className="mt-2 inline-block text-xs text-dim underline hover:text-ink"
        >
          Sign out
        </a>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={!configured || busy}
        onClick={() => {
          setBusy(true);
          startKickLogin();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-kick px-4 py-3 text-sm font-bold text-black transition hover:brightness-95 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M3 3h5v6l4-6h6l-6 9 6 9h-6l-4-6v6H3z" />
        </svg>
        {busy ? "Redirecting to Kick…" : "Continue with Kick"}
      </button>
      {!configured && (
        <p className="mt-2 text-center text-xs text-faint">
          Kick sign-in isn&apos;t configured yet — set NEXT_PUBLIC_KICK_CLIENT_ID and
          KICK_CLIENT_SECRET in the deployment.
        </p>
      )}
    </>
  );
}
