"use client";

import { useEffect } from "react";
import { currentKickUser } from "@/lib/kickAuth";

/* Keeps the Kick sign-in alive so the session persists until the user
   explicitly logs out. Kick access tokens last ~1h and rotate; this silently
   POSTs /api/auth/kick/refresh on load, on a timer (under the token lifetime),
   and when the tab regains focus, swapping in a fresh token via the long-lived
   refresh cookie. If Kick reports the refresh token is dead (only after long
   inactivity), it reloads once to reflect the signed-out state.

   No-ops when signed out, and on the static Pages export where /api doesn't
   exist (Kick login is Vercel-only there anyway). */

const REFRESH_EVERY_MS = 45 * 60 * 1000; // 45 min — comfortably under ~1h tokens
const MIN_GAP_MS = 5 * 60 * 1000; // don't refresh more than once per 5 min

export default function KickSessionKeeper() {
  useEffect(() => {
    if (!currentKickUser()) return; // not signed in — nothing to keep alive

    let stopped = false;
    let last = 0;

    const refresh = async (force: boolean) => {
      const now = Date.now();
      if (!force && now - last < MIN_GAP_MS) return;
      last = now;
      try {
        const r = await fetch("/api/auth/kick/refresh", { method: "POST", cache: "no-store" });
        // Only a hard rejection means truly logged out; reload to show it.
        if (r.status === 401) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          if (j.error === "refresh_failed" && !stopped) window.location.reload();
        }
      } catch {
        /* transient — the interval / next focus will retry */
      }
    };

    refresh(true); // renew immediately in case the access token already lapsed
    const id = setInterval(() => refresh(true), REFRESH_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
