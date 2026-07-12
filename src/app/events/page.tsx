import Link from "next/link";
import { EVENTS, type SiteEvent } from "@/lib/events";

export const metadata = {
  title: "Events — ChickenAndy",
  description: "Live and upcoming ChickenAndy events across Kick.",
};

function EventCard({ event }: { event: SiteEvent }) {
  const live = event.status === "live";
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-neutral-600">
      <div
        className="relative h-28 sm:h-32"
        style={{
          background: `linear-gradient(135deg, hsl(${event.hue} 70% 22%), hsl(${event.hue + 24} 65% 12%))`,
        }}
      >
        <span
          className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
            live ? "bg-mature text-white" : "bg-black/40 text-neutral-200 ring-1 ring-white/20"
          }`}
        >
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
          {live ? "Live now" : "Upcoming"}
        </span>
        <h2 className="absolute bottom-3 left-4 right-4 font-display text-2xl font-black uppercase text-white drop-shadow">
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

export default function EventsPage() {
  const liveEvents = EVENTS.filter((e) => e.status === "live");
  const upcoming = EVENTS.filter((e) => e.status === "upcoming");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="font-display text-3xl font-black uppercase">Events</h1>
        <p className="mt-1 text-sm text-neutral-500">
          What&apos;s happening across Kick — live now and coming up.
        </p>
      </header>

      {liveEvents.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2.5 font-display text-lg font-extrabold uppercase tracking-wide">
            <span className="h-5 w-1 rounded-full bg-mature" />
            Happening now
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {liveEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2.5 font-display text-lg font-extrabold uppercase tracking-wide">
            <span className="h-5 w-1 rounded-full bg-accent" />
            Upcoming
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
