"use client";

import { useFavourites } from "@/lib/useFavourites";

/** Green Kick wordmark pill. */
export function KickBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-kick ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M3 3h5v6l4-6h6l-6 9 6 9h-6l-4-6v6H3z" />
      </svg>
      Kick
    </span>
  );
}

export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 text-accent ${className}`}
      fill="currentColor"
      aria-label="Verified"
    >
      <path d="m12 1.5 2.6 1.9 3.2-.2 1 3.1 2.7 1.8-1 3.1 1 3.1-2.7 1.8-1 3.1-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3.1-2.7-1.8 1-3.1-1-3.1 2.7-1.8 1-3.1 3.2.2z" />
      <path d="m8.5 12 2.3 2.3 4.7-4.7" stroke="var(--color-bg)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MatureBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded bg-mature px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${className}`}
    >
      18+
    </span>
  );
}

export function LivePill({ viewers }: { viewers: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
      <span className="live-dot h-2 w-2 rounded-full bg-live" />
      {viewers}
    </span>
  );
}

export function FavButton({
  slug,
  size = 18,
  className = "",
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const { isFav, toggle } = useFavourites();
  const active = isFav(slug);
  return (
    <button
      type="button"
      aria-label={active ? `Remove ${slug} from favourites` : `Favourite ${slug}`}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      className={`grid place-items-center rounded-full border border-line bg-black/40 p-2 text-dim transition hover:text-accent hover:border-accent/50 ${
        active ? "text-accent border-accent/60" : ""
      } ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 17.3 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.9L12 2.5l2.9 6 6.5.9-4.7 4.6 1.1 6.5z" />
      </svg>
    </button>
  );
}
