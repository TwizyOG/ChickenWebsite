"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchForumStats,
  fetchKickLite,
  fmtMonthYear,
  type ForumStats,
  type KickLite,
} from "@/lib/hovercard";
import { fmtCount } from "@/lib/kick";
import { VerifiedBadge } from "@/components/ui";

/** Wraps a username; hover (300ms intent) or tap shows Kick + forum stats. */
export default function UserHovercard({
  username,
  kickId,
  children,
}: {
  username: string | null;
  kickId: number | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [kick, setKick] = useState<KickLite | null>(null);
  const [forum, setForum] = useState<ForumStats | null>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || loaded.current || !username) return;
    loaded.current = true;
    fetchKickLite(username).then(setKick).catch(() => {});
    if (kickId != null) fetchForumStats(kickId).then(setForum).catch(() => {});
  }, [open, username, kickId]);

  if (!username) return <>{children}</>;

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 300);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  const joined = fmtMonthYear(kick?.joined ?? null);
  const member = fmtMonthYear(forum?.memberSince ?? null);

  return (
    <span className="relative inline-block" onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" onClick={() => setOpen(!open)} className="cursor-pointer">
        {children}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-line bg-elevated p-3 text-left shadow-xl">
          <div className="flex items-center gap-2.5">
            {kick?.avatar ? (
              <img src={kick.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-bold text-neutral-300">
                {username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-bold text-neutral-100">
                {username}
                {kick?.verified && <VerifiedBadge />}
                {forum && forum.role !== "user" && (
                  <span
                    className={`rounded px-1 py-px text-[9px] font-bold uppercase ${
                      forum.role === "admin"
                        ? "bg-accent/15 text-accent"
                        : "bg-emerald-400/15 text-emerald-300"
                    }`}
                  >
                    {forum.role === "admin" ? "Admin" : "Mod"}
                  </span>
                )}
              </p>
              <a
                href={`https://kick.com/${encodeURIComponent(username.toLowerCase())}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-neutral-500 hover:text-accent"
              >
                kick.com/{username.toLowerCase()}
              </a>
            </div>
          </div>
          <div className="mt-2.5 space-y-1 text-xs text-neutral-400">
            <p>
              <span className="font-semibold text-neutral-200">
                {kick?.followers != null ? fmtCount(kick.followers) : "—"}
              </span>{" "}
              followers
              {joined && (
                <>
                  {" · "}on Kick since <span className="font-semibold text-neutral-200">{joined}</span>
                </>
              )}
            </p>
            {forum && (
              <p>
                <span className="font-semibold text-neutral-200">{forum.postKarma}</span> post karma ·{" "}
                <span className="font-semibold text-neutral-200">{forum.commentKarma}</span> comment karma
                {member && (
                  <>
                    {" · "}here since{" "}
                    <span className="font-semibold text-neutral-200">{member}</span>
                  </>
                )}
              </p>
            )}
            {!kick && !forum && <p className="text-neutral-600">Loading…</p>}
          </div>
        </div>
      )}
    </span>
  );
}
