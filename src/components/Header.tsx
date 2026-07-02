"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Logo from "./Logo";
import { currentKickUser } from "@/lib/kickAuth";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/streamers", label: "Streamers" },
  { href: "/map", label: "RV X" },
  { href: "/community", label: "Community" },
  { href: "/store", label: "Store" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setUser(currentKickUser());
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/streamers?q=${encodeURIComponent(q.trim())}` : "/streamers");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      {/* decorative gold banner strip */}
      <div className="relative h-9 overflow-hidden border-b border-line/60">
        <div className="absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_0%,rgba(227,178,60,0.25),transparent)]" />
        <div className="absolute inset-0 opacity-[0.12] bg-[repeating-linear-gradient(90deg,#e3b23c_0_2px,transparent_2px_10px)]" />
        <div className="relative h-full grid place-items-center">
          <span className="font-display text-[11px] font-bold tracking-[0.35em] text-accent/90">
            ● LIVE STREAMER DIRECTORY ●
          </span>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="ChickenAndy home" className="shrink-0">
          <Logo />
        </Link>

        <form onSubmit={submit} className="relative ml-auto hidden md:block w-64 lg:w-80">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search streamers..."
            className="w-full rounded-full border border-line bg-elevated py-2 pl-9 pr-12 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] text-faint">
            ⌘K
          </kbd>
        </form>

        {user ? (
          <div className="ml-auto md:ml-0 flex items-center gap-2">
            <span className="hidden sm:inline text-sm font-semibold text-kick" title="Signed in with Kick">
              {user}
            </span>
            <a
              href="/api/auth/kick/logout"
              className="rounded-full border border-line px-3 py-2 text-sm font-medium text-dim transition hover:text-ink"
            >
              Sign out
            </a>
          </div>
        ) : (
          <Link
            href="/login"
            className="ml-auto md:ml-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft"
          >
            Sign in
          </Link>
        )}
      </div>

      <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4 sm:px-6">
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`relative px-3 py-3 text-sm font-medium transition ${
                active ? "text-accent" : "text-dim hover:text-ink"
              }`}
            >
              {n.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
