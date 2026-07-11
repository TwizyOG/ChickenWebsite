"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Logo from "./Logo";
import { currentKickUser } from "@/lib/kickAuth";
import { getProfile, onProfileChange } from "@/lib/profile";
import { useAuth, displayName } from "./AuthProvider";
import {
  getNotices,
  markAllRead,
  onNoticesChange,
  timeAgo,
  type Notice,
} from "@/lib/notifications";
import {
  fetchForumNotifications,
  markForumNotificationsRead,
  mergeBellItems,
  type BellItem,
} from "@/lib/forumNotifications";

/* Site header matching chickenandy.vercel.app: single row with the logo,
   inline nav (lg+), search, and — when signed in — the notification bell with
   its dropdown overlay plus the avatar chip opening the account menu
   (My Profile / Favorite Streamers / Sign Out); the gold "Sign in" button
   otherwise. Below it, the horizontally scrolling mobile nav. */

const NAV = [
  { href: "/", label: "Home" },
  { href: "/streamers", label: "Streamers" },
  { href: "/rvx", label: "RV X" },
  { href: "/community", label: "Community" },
  { href: "/store", label: "Store" },
  { href: "/about", label: "About" },
];

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function StarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9L12 3z" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M9 17l-5-5 5-5" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z" />
    </svg>
  );
}

function BellItemIcon({ icon }: { icon: BellItem["icon"] }) {
  if (icon === "live") return <LiveDotIcon />;
  if (icon === "reply") return <ReplyIcon />;
  if (icon === "removed") return <ShieldIcon />;
  return <StarIcon />;
}

function LiveDotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mobileSearch, setMobileSearch] = useState(false);
  const { user: siteUser, signOut } = useAuth();
  const [kickUser, setKickUser] = useState<string | null>(null);
  const [profile, setProfile] = useState({ username: "", location: "", avatar: "" });
  const [notices, setNotices] = useState<Notice[]>([]);
  const [forumBell, setForumBell] = useState<{ items: BellItem[]; unread: number }>({
    items: [],
    unread: 0,
  });
  const [menu, setMenu] = useState<null | "bell" | "user">(null);
  const menusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKickUser(currentKickUser());
    setProfile(getProfile());
    setMenu(null);
  }, [pathname]);

  // Reflect profile edits and new notifications without a full reload.
  useEffect(() => onProfileChange(() => setProfile(getProfile())), []);
  useEffect(() => {
    setNotices(getNotices());
    return onNoticesChange(() => setNotices(getNotices()));
  }, []);

  // Forum notifications (server-backed) join the bell when Kick-signed-in.
  useEffect(() => {
    if (!kickUser) return;
    let stale = false;
    const load = () =>
      fetchForumNotifications().then((f) => {
        if (!stale) setForumBell(f);
      });
    load();
    window.addEventListener("focus", load);
    return () => {
      stale = true;
      window.removeEventListener("focus", load);
    };
  }, [kickUser]);

  // Close dropdowns on outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menusRef.current && !menusRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // Your chosen account display name wins over the raw Kick provider name.
  const account = displayName(siteUser) || profile.username || kickUser;
  const initial = (account?.[0] || "?").toUpperCase();
  const signedIn = Boolean(siteUser || kickUser);
  const unread = notices.filter((n) => !n.read).length + forumBell.unread;
  const bellItems = mergeBellItems(notices, forumBell.items);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/streamers?q=${encodeURIComponent(q.trim())}` : "/streamers");
    setMobileSearch(false);
  };

  const doSignOut = useCallback(async () => {
    setMenu(null);
    if (siteUser) await signOut();
    if (kickUser) {
      window.location.href = "/api/auth/kick/logout";
    } else {
      window.location.href = "/";
    }
  }, [siteUser, kickUser, signOut]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-12 xl:px-16">
        <Link href="/" aria-label="ChickenAndy home" className="shrink-0">
          <Logo />
        </Link>

        {/* desktop nav */}
        <nav className="ml-4 hidden items-center gap-6 text-sm font-semibold lg:flex">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative py-1 transition ${
                  active ? "text-accent" : "text-dim hover:text-ink"
                }`}
              >
                {n.label}
                {active && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* desktop search */}
        <form onSubmit={submit} className="hidden w-60 sm:block">
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-elevated px-3 transition hover:border-faint/60">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 text-faint"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.2-4.2" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search streamers…"
              aria-label="Search streamers"
              className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint"
            />
            <kbd className="hidden shrink-0 rounded border border-line px-1.5 text-[11px] text-faint sm:block">
              ⌘K
            </kbd>
          </div>
        </form>

        {/* mobile search toggle */}
        <button
          type="button"
          aria-label="Search"
          aria-expanded={mobileSearch}
          onClick={() => setMobileSearch((v) => !v)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-dim transition hover:border-accent/40 hover:text-accent sm:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.2-4.2" />
          </svg>
        </button>

        {account ? (
          <div ref={menusRef} className="flex shrink-0 items-center gap-2">
            {/* notification bell + overlay */}
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label={`Notifications (${unread} unread)`}
                aria-expanded={menu === "bell"}
                onClick={() => setMenu(menu === "bell" ? null : "bell")}
                className="relative grid h-9 w-9 place-items-center rounded-full border border-line text-dim transition hover:border-accent/40 hover:text-accent"
              >
                <BellIcon />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-black text-accent-ink">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {menu === "bell" && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/60"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-extrabold uppercase tracking-wide text-ink">
                      Notifications
                    </span>
                    <button
                      onClick={() => {
                        markAllRead();
                        markForumNotificationsRead();
                        setForumBell((prev) => ({
                          items: prev.items.map((i) => ({ ...i, read: true })),
                          unread: 0,
                        }));
                      }}
                      className="text-xs font-bold text-accent hover:text-accent-soft"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="h-px bg-line" />
                  <div className="max-h-[22rem] overflow-y-auto">
                    {bellItems.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-faint">
                        No notifications yet.
                      </p>
                    ) : (
                      bellItems.slice(0, 12).map((n) => (
                        <Link
                          key={n.key}
                          href={n.href}
                          onClick={() => setMenu(null)}
                          className={`flex items-start gap-3 px-4 py-3 transition hover:bg-elevated ${
                            n.read ? "" : "bg-accent/5"
                          }`}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-elevated text-accent">
                            <BellItemIcon icon={n.icon} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {n.text}
                            </span>
                            {n.sub && (
                              <span className="block truncate text-xs text-dim">{n.sub}</span>
                            )}
                            <span className="mt-0.5 block text-[11px] text-neutral-600">
                              {timeAgo(n.at)}
                            </span>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                  <a
                    className="block px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-accent transition hover:bg-elevated"
                    href="/account/notifications"
                  >
                    View all notifications
                  </a>
                </div>
              )}
            </div>

            {/* avatar chip + account menu */}
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={menu === "user"}
                title={account}
                onClick={() => setMenu(menu === "user" ? null : "user")}
                className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-accent bg-elevated text-sm font-black text-accent transition hover:shadow-[0_0_0_3px_rgba(227,178,60,0.2)]"
              >
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{initial}</span>
                )}
              </button>
              {menu === "user" && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/60"
                >
                  <div className="flex items-center gap-3 px-3.5 py-3.5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-accent bg-elevated text-base font-black text-accent">
                      {profile.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-ink">{account}</div>
                      {signedIn && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-accent" aria-label="verified">
                              <circle cx="12" cy="12" r="10" fill="currentColor" />
                              <path
                                d="M7 12.5l3 3 7-7"
                                fill="none"
                                stroke="#0a0a0b"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>{" "}
                            Verified
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="h-px bg-line" />
                  <div className="py-1.5">
                    <Link
                      href="/account"
                      onClick={() => setMenu(null)}
                      className="group flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-elevated"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <circle cx="12" cy="7" r="4" />
                        <path d="M5 20a7 7 0 0 1 14 0" />
                      </svg>
                      My Profile
                    </Link>
                    <Link
                      href="/account/favorites"
                      onClick={() => setMenu(null)}
                      className="group flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-elevated"
                    >
                      <StarIcon />
                      Favorite Streamers
                    </Link>
                    <button
                      type="button"
                      onClick={doSignOut}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="m16 17 5-5-5-5M21 12H9" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft active:scale-95"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* mobile search row */}
      {mobileSearch && (
        <form onSubmit={submit} className="border-t border-line px-4 py-2 sm:hidden">
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-elevated px-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 text-faint"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.2-4.2" />
            </svg>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search streamers…"
              aria-label="Search streamers"
              className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint"
            />
          </div>
        </form>
      )}

      {/* mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-line px-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold transition ${
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-faint hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
