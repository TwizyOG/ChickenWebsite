import { CITIES, RVX_EVENT } from "@/lib/rvx";

/* Events hub data. "Events" replaces the old single RV X tab so the site can
   list everything happening across Kick — the live RV X trip plus upcoming
   one-offs. RV X stays data-driven (its current stop drives the card); other
   events are declared statically here. */

export type SiteEvent = {
  id: string;
  name: string;
  status: "live" | "upcoming";
  tagline: string;
  blurb: string;
  when: string; // human-readable label
  where: string;
  href?: string; // internal detail page
  watchUrl?: string; // external Kick channel (live events only)
  hue: number; // card gradient hue
};

const current = CITIES.find((c) => c.status === "current");
const stop = current ? `${current.name}, ${current.region}` : "Boston, MA";

export const EVENTS: SiteEvent[] = [
  {
    id: "rvx",
    name: RVX_EVENT.name,
    status: "live",
    tagline: RVX_EVENT.premise,
    blurb: `The cross-country run is parked in ${stop}, streaming 24/7 with the crew. Live map, clips & VODs, and the day-by-day trip log inside.`,
    when: "Live now",
    where: stop,
    href: "/rvx",
    watchUrl: "https://kick.com/chickenandy",
    hue: 42,
  },
  {
    id: "deepak-prison-stream",
    name: "Deepak Prison Stream",
    status: "upcoming",
    tagline: "A first-of-its-kind Kick stream event.",
    blurb:
      "Deepak takes the stream behind the walls for a one-of-a-kind prison stream event. More details to come — mark the date.",
    when: "Starts July 18, 2026",
    where: "Kick",
    hue: 265,
  },
];
