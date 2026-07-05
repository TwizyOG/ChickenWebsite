"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Logo from "./Logo";
import { currentKickUser } from "@/lib/kickAuth";
import { getProfile, onProfileChange } from "@/lib/profile";
import { useAuth, displayName } from "./AuthProvider";

/* Site header matching chickenandy.vercel.app: single row with the logo,
   inline nav (lg+), search, and either the gold "Sign in" button or the avatar
   chip linking to /account; below it, the horizontally scrolling mobile nav.
   (Sign out lives in the account sidebar, like the live site.) */

const NAV = [
  { href: "/", label: "Home" },
  { href: "/streamers", label: "Streamers" },
  { href: "/rvx", label: "RV X" },
  { href: "/community", label: "Community" },
  { href: "/store", label: "Store" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mobileSearch, setMobileSearch] = useState(false);
  const { user: siteUser } = useAuth();
  const [kickUser, setKickUser] = useState<string | null>(null);
  const [profile, setProfile] = useState({ username: "", location: "", avatar: "" });

  useEffect(() => {
    setKickUser(currentKickUser());
    setProfile(getProfile());
  }, [pathname]);

  // Reflect profile edits made on the account page without a full reload.
  useEffect(() => onProfileChange(() => setProfile(getProfile())), []);

  // Your chosen account display name wins over the raw Kick provider name.
  const account = displayName(siteUser) || profile.username || kickUser;
  const initial = (account?.[0] || "?").toUpperCase();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/streamers?q=${encodeURIComponent(q.trim())}` : "/streamers");
    setMobileSearch(false);
  };

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
          <Link href="/account" aria-label="My account" title={account} className="shrink-0">
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar}
                alt=""
                className="h-9 w-9 rounded-full border border-accent/50 object-cover transition hover:brightness-110"
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-display text-sm font-black text-accent-ink transition hover:brightness-110">
                {initial}
              </span>
            )}
          </Link>
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
