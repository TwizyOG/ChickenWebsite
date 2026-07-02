import MapEmbed from "@/components/MapEmbed";
import { RVX_EVENT, CITIES } from "@/lib/rvx";

export const metadata = {
  title: "RV X Route — ChickenAndy",
  description: RVX_EVENT.premise,
};

export default function MapPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-accent">
            {RVX_EVENT.year} · Live now · {RVX_EVENT.start} → now
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold uppercase sm:text-4xl">
            {RVX_EVENT.name}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-dim">{RVX_EVENT.premise}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {CITIES.map((c, i) => (
            <span key={c.id} className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  c.status === "current"
                    ? "bg-kick/15 text-kick"
                    : "bg-elevated text-dim"
                }`}
              >
                {c.name}
              </span>
              {i < CITIES.length - 1 && <span className="text-faint">→</span>}
            </span>
          ))}
        </div>
      </header>

      <div className="mt-6 h-[72vh]">
        <MapEmbed />
      </div>
    </div>
  );
}
