"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { currentKickUser } from "@/lib/kickAuth";

type Sub = { id?: string; name?: string; event?: string; version?: number };

const nameOf = (s: Sub) => s.name || s.event || "event";

export default function KickEventsPanel() {
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  const refresh = async (): Promise<Sub[]> => {
    try {
      const r = await fetch("/api/kick/subscribe", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const list = Array.isArray(j.data) ? (j.data as Sub[]) : [];
        setSubs(list);
        return list;
      }
    } catch {
      /* ignore */
    }
    return [];
  };

  const subscribe = async (silent = false) => {
    setBusy(true);
    if (!silent) setStatus("Subscribing to events…");
    try {
      const r = await fetch("/api/kick/subscribe", { method: "POST" });
      if (r.ok) {
        const after = await refresh();
        setStatus(`Subscribed — ${after.length} event${after.length === 1 ? "" : "s"} active.`);
      } else {
        setStatus(r.status === 401 ? "Please sign in with Kick first." : `Subscribe failed (${r.status}).`);
      }
    } catch {
      setStatus("Network error — try again.");
    }
    setBusy(false);
  };

  const unsubscribe = async () => {
    setBusy(true);
    setStatus("Removing subscriptions…");
    try {
      await fetch("/api/kick/subscribe", { method: "DELETE" });
      await refresh();
      setStatus("Event subscriptions turned off.");
    } catch {
      setStatus("Network error — try again.");
    }
    setBusy(false);
  };

  useEffect(() => {
    const u = currentKickUser();
    setUser(u);
    if (!u) {
      setReady(true);
      return;
    }
    (async () => {
      const list = await refresh();
      // Automatic after login: if nothing is subscribed yet, subscribe once.
      if (list.length === 0 && !autoTried.current) {
        autoTried.current = true;
        await subscribe(true);
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return (
      <div className="rounded-xl border border-line bg-elevated p-5">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">Kick event webhooks</h3>
        <p className="mt-2 text-sm text-dim">
          Sign in with Kick to subscribe your channel to live events (chat, follows, subs, stream
          status) delivered to this site&apos;s webhook.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-full bg-kick px-4 py-2 text-sm font-bold text-black transition hover:brightness-95"
        >
          Sign in with Kick
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-elevated p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">Kick event webhooks</h3>
        <span
          className={`h-2 w-2 rounded-full ${subs.length ? "bg-kick" : ready ? "bg-faint" : "bg-accent"}`}
          title={subs.length ? "Active" : "Off"}
        />
      </div>
      <p className="mt-2 text-sm text-dim">
        Events for <span className="font-semibold text-kick">{user}</span> are delivered to{" "}
        <code className="rounded bg-panel px-1 py-0.5 text-xs">/api/kick/webhook</code>.
      </p>

      {subs.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {subs.map((s, i) => (
            <span key={s.id ?? i} className="rounded-full bg-panel px-2.5 py-1 text-xs text-dim">
              {nameOf(s)}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-faint">
          {ready ? "No active subscriptions." : "Checking subscriptions…"}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => subscribe(false)}
          disabled={busy}
          className="rounded-full bg-kick px-4 py-2 text-sm font-bold text-black transition hover:brightness-95 disabled:opacity-50"
        >
          {subs.length ? "Re-subscribe" : "Subscribe to events"}
        </button>
        {subs.length > 0 && (
          <button
            onClick={unsubscribe}
            disabled={busy}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium text-dim transition hover:text-ink disabled:opacity-50"
          >
            Turn off
          </button>
        )}
        {status && <span className="text-xs text-faint">{status}</span>}
      </div>
    </div>
  );
}
