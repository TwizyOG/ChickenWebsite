"use client";

import { useEffect, useState } from "react";
import {
  getNotices,
  markAllRead,
  onNoticesChange,
  timeAgo,
  type Notice,
} from "@/lib/notifications";

/* Notifications page body — mirrors chickenandy.vercel.app/account/notifications.
   A real feed: go-live alerts for favorites (FavoriteLiveWatcher) and account
   updates (profile saved, password changed, Kick connected…). Opening the page
   marks everything read. */

export default function AccountNotifications() {
  const [notices, setNotices] = useState<Notice[] | null>(null);

  useEffect(() => {
    setNotices(getNotices());
    const off = onNoticesChange(() => setNotices(getNotices()));
    // Viewing the page clears the unread badge (after the list renders once so
    // the unread highlights are visible for a beat).
    const t = setTimeout(() => markAllRead(), 1200);
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);

  if (notices === null) return null;

  if (notices.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-10 text-center">
        <p className="font-semibold text-ink">No notifications yet.</p>
        <p className="mt-1 text-sm text-faint">
          You&apos;ll be notified when a favorite goes live and for account updates.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <ul className="divide-y divide-line">
        {notices.map((n) => (
          <li
            key={n.id}
            className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${
              n.read ? "" : "bg-accent/5"
            }`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                n.kind === "live" ? "bg-live/15 text-live" : "bg-accent/15 text-accent"
              }`}
            >
              {n.kind === "live" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
                  <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
                  <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9" />
                  <path d="M10.3 20a2 2 0 0 0 3.4 0" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{n.text}</p>
              {n.sub && <p className="truncate text-xs text-dim">{n.sub}</p>}
            </div>
            <span className="shrink-0 text-xs text-faint">{timeAgo(n.at)}</span>
            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
