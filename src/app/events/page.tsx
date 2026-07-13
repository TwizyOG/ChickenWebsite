import { EVENTS } from "@/lib/events";
import EventCard from "@/components/EventCard";

export const metadata = {
  title: "Events — ChickenAndy",
  description: "Live and upcoming ChickenAndy events across Kick.",
};

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
