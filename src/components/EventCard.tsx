import Link from "next/link";
import { type SiteEvent } from "@/lib/events";
import { asset } from "@/lib/assetPath";

/* One event card. The banner is either an animated scene (RV X, an <img> that
   always loads and animates) or a poster image layered over a hue gradient via
   CSS background-image — so a poster that isn't present yet simply doesn't
   paint and the gradient shows through (no broken image, no client JS). */

export default function EventCard({ event }: { event: SiteEvent }) {
  const live = event.status === "live";
  const gradient = `linear-gradient(135deg, hsl(${event.hue} 70% 22%), hsl(${event.hue + 24} 65% 12%))`;
  const hasScene = Boolean(event.scene);
  const hasBg = hasScene || Boolean(event.image);

  const bannerStyle: React.CSSProperties = event.image
    ? {
        backgroundImage: `url(${asset(event.image)}), ${gradient}`,
        backgroundSize: "cover",
        backgroundPosition: "center 30%",
      }
    : hasScene
      ? { backgroundColor: "#0b0b0d" }
      : { background: gradient };

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-neutral-600">
      <div className="relative h-28 overflow-hidden sm:h-32" style={bannerStyle}>
        {hasScene && (
          <img
            src={asset(`/${event.scene}.svg`)}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {hasBg && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/40" />
        )}

        <span
          className={`absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
            live ? "bg-mature text-white" : "bg-black/50 text-neutral-100 ring-1 ring-white/25"
          }`}
        >
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
          {live ? "Live now" : "Upcoming"}
        </span>
        <h2 className="absolute bottom-3 left-4 right-4 z-10 font-display text-2xl font-black uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
          {event.name}
        </h2>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold text-neutral-200">{event.tagline}</p>
        <p className="mt-1.5 text-sm text-neutral-400">{event.blurb}</p>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span>
            <span className="text-neutral-600">When · </span>
            {event.when}
          </span>
          <span>
            <span className="text-neutral-600">Where · </span>
            {event.where}
          </span>
          {event.host && (
            <span>
              <span className="text-neutral-600">Host · </span>
              {event.host}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {event.href && (
            <Link
              href={event.href}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft active:scale-95"
            >
              View event
            </Link>
          )}
          {event.watchUrl && (
            <a
              href={event.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100"
            >
              Watch on Kick
            </a>
          )}
          {!event.href && !event.watchUrl && (
            <span className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-neutral-500">
              Details soon
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
