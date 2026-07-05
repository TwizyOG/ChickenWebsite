"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "../Logo";
import { useAuth, displayName } from "../AuthProvider";
import { currentKickUser } from "@/lib/kickAuth";
import { getProfile, onProfileChange } from "@/lib/profile";
import { unreadCount, onNoticesChange } from "@/lib/notifications";

/* Standalone account layout matching chickenandy.vercel.app/account*:
   left sidebar (logo + ACCOUNT chip, icon nav with gold active bar, user block
   + Sign out at the bottom), topbar with uppercase page title, bell and
   "View site", and the page content in the remaining space. */

const NAV = [
  {
    href: "/account",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  },
  {
    href: "/account/security",
    label: "Security",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="M12 2.5 4.5 5.5v6c0 4.7 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.8 7.5-9.5v-6z" />
      </svg>
    ),
  },
  {
    href: "/account/connected",
    label: "Connected Accounts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 1 0-6.4-6.4l-1.7 1.7" />
        <path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 1 0 6.4 6.4l1.7-1.7" />
      </svg>
    ),
  },
  {
    href: "/account/favorites",
    label: "Favorite Streamers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="M12 17.3 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.9L12 2.5l2.9 6 6.5.9-4.7 4.6 1.1 6.5z" />
      </svg>
    ),
  },
  {
    href: "/account/notifications",
    label: "Notifications",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9" />
        <path d="M10.3 20a2 2 0 0 0 3.4 0" />
      </svg>
    ),
  },
];

const TITLES: Record<string, string> = {
  "/account": "Profile",
  "/account/security": "Security",
  "/account/connected": "Connected Accounts",
  "/account/favorites": "Favorite Streamers",
  "/account/notifications": "Notifications",
};

export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user: siteUser, signOut } = useAuth();
  const [kickUser, setKickUser] = useState<string | null>(null);
  const [profile, setProfile] = useState({ username: "", location: "", avatar: "" });
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setKickUser(currentKickUser());
    setProfile(getProfile());
    setUnread(unreadCount());
    const offP = onProfileChange(() => setProfile(getProfile()));
    const offN = onNoticesChange(() => setUnread(unreadCount()));
    return () => {
      offP();
      offN();
    };
  }, [pathname]);

  const name = profile.username || displayName(siteUser) || kickUser || "Guest";
  const initial = (name[0] || "?").toUpperCase();
  const signedIn = Boolean(siteUser || kickUser);
  const title = TITLES[pathname] ?? "Account";

  const doSignOut = async () => {
    if (siteUser) await signOut();
    if (kickUser) {
      window.location.href = "/api/auth/kick/logout";
    } else {
      window.location.href = "/";
    }
  };

  const isActive = (href: string) => (href === "/account" ? pathname === "/account" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-panel/70 md:flex">
        <div className="flex items-center gap-2 px-4 py-5">
          <Link href="/" className="shrink-0">
            <Logo />
          </Link>
          <span className="rounded border border-line bg-elevated px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-faint">
            Account
          </span>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-accent/10 text-accent" : "text-dim hover:bg-elevated hover:text-ink"
                }`}
              >
                {active && (
                  <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                {n.icon}
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line px-4 py-4">
          <div className="flex items-center gap-3">
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border border-accent/50 object-cover"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-black text-accent-ink">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Member</p>
            </div>
          </div>
          {signedIn ? (
            <button
              type="button"
              onClick={doSignOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm font-semibold text-mature transition hover:bg-mature/10"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5M21 12H9" />
              </svg>
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-accent py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line px-4 sm:px-6">
          <h1 className="font-display text-lg font-black uppercase tracking-wide">{title}</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/account/notifications"
              aria-label="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-full border border-line text-dim transition hover:border-accent/50 hover:text-accent"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9" />
                <path d="M10.3 20a2 2 0 0 0 3.4 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-dim transition hover:border-accent/50 hover:text-ink"
            >
              View site
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </Link>
          </div>
        </header>

        {/* mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-line px-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold transition ${
                  active ? "border-accent text-accent" : "border-transparent text-faint hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
