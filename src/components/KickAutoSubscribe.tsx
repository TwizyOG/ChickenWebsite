"use client";

import { useEffect } from "react";
import { currentKickUser } from "@/lib/kickAuth";

/* Headless keeper of the behaviour that used to live in the account page's
   "Kick event webhooks" panel (removed from the UI — users don't need to see
   API plumbing). After a Kick sign-in, if the channel has no event
   subscriptions yet, subscribe once per browser session. Silently no-ops when
   signed out and on the static GitHub Pages export (no /api routes there). */
export default function KickAutoSubscribe() {
  useEffect(() => {
    if (!currentKickUser()) return;
    try {
      if (sessionStorage.getItem("kick:autosub")) return;
      sessionStorage.setItem("kick:autosub", "1");
    } catch {
      return; // storage unavailable — skip rather than spam the endpoint
    }
    (async () => {
      try {
        const r = await fetch("/api/kick/subscribe", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { data?: unknown[] };
        if (Array.isArray(j.data) && j.data.length === 0) {
          await fetch("/api/kick/subscribe", { method: "POST" });
        }
      } catch {
        /* static build / offline — fine */
      }
    })();
  }, []);
  return null;
}
