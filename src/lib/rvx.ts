/* RV X event — ported in full from the original site's data.js (src/lib/rvx).
   The trip now runs Austin → New Orleans → Tampa → Orlando → Miami. Only RV X is
   kept (RV 7 / RV 8 archives out of scope). Cities drive the route line, markers,
   popups and the driven RV animation; crew + day notes drive the RV X hub tabs. */

export type City = {
  id: string;
  stop: number;
  name: string;
  region: string;
  lon: number;
  lat: number;
  start: string;
  end: string | null;
  status: "done" | "current";
  blurb: string;
};

export const RVX_EVENT = {
  id: "rvx",
  name: "RV X",
  year: "2026",
  premise: "The 2026 Gulf Run — Austin to Miami, streamed 24/7.",
  start: "04/10/26",
  end: null as string | null,
  route: ["Austin, TX", "New Orleans, LA", "Tampa, FL", "Orlando, FL", "Miami, FL"],
};

export const CITIES: City[] = [
  {
    id: "austin", stop: 1, name: "Austin", region: "TX",
    lon: -97.7431, lat: 30.2672,
    start: "04/10/26", end: "04/13/26", status: "done",
    blurb: "Where the wheels started turning. Three days of setup, send-offs and 6th Street chaos.",
  },
  {
    id: "nola", stop: 2, name: "New Orleans", region: "LA",
    lon: -90.0715, lat: 29.9511,
    start: "04/14/26", end: "04/30/26", status: "done",
    blurb: "Seventeen days in the Quarter — brass bands, beignets and one towed RV.",
  },
  {
    id: "tampa", stop: 3, name: "Tampa", region: "FL",
    lon: -82.4572, lat: 27.9506,
    start: "04/30/26", end: "06/01/26", status: "done",
    blurb: "A full month on the Gulf side. Beach days, boat day, and the great generator failure.",
  },
  {
    id: "orlando", stop: 4, name: "Orlando", region: "FL",
    lon: -81.3792, lat: 28.5383,
    start: "06/01/26", end: "06/25/26", status: "done",
    blurb: "Theme-park week with the whole crew — teacups, golf carts and 10,000 trip miles.",
  },
  {
    id: "miami", stop: 5, name: "Miami", region: "FL",
    lon: -80.1918, lat: 25.7617,
    start: "06/25/26", end: null, status: "current",
    blurb: "Current stop. South Beach, the marina and the final leg of the Gulf Run.",
  },
];

export const MAP_SOURCES = {
  satTiles: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
  satAttrib: "Sentinel-2 cloudless © EOX IT Services GmbH",
  demUrl: "https://tiles.mapterhorn.com/tilejson.json",
  vectorLight: "https://tiles.openfreemap.org/styles/liberty",
  darkTiles: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
  darkAttrib: "© OpenStreetMap contributors © CARTO",
  osrm: "https://router.project-osrm.org/route/v1/driving",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
};

/* ---- RV crew (from the original data.js CAST) --------------------------- */
export type CrewMember = {
  slug: string | null; // Kick channel slug (null for non-streamers)
  name: string;
  role: string;
  bio: string;
  departed?: boolean;
};

export const CREW: CrewMember[] = [
  { slug: "chickenandytv", name: "ChickenAndy", role: "Driver", bio: "The man behind the wheel. Streaming the whole ride on Kick." },
  { slug: "krispyw", name: "KrispyW", role: "Chaos dept.", bio: "If a bet exists, Krispy has already lost it." },
  { slug: "ryanheinz", name: "Ryan Heinz", role: "Camera", bio: "Second angle, drone shots, beignet records." },
  { slug: null, name: "Cam", role: "Logistics", bio: "Keeps the rig rolling and the cooler full." },
  { slug: "kikikrazy", name: "KikiKrazy", role: "Crew", bio: "IRL streamer bringing her own lens to the road trip." },
  { slug: "tazo", name: "Tazo", role: "Crew", bio: "On the road with the crew for the Gulf run." },
  { slug: "oceanadventures", name: "Ocean Adventures", role: "Special guest", bio: "Joined the rig for the Florida legs." },
  { slug: "toneirl", name: "Tone", role: "Navigator", bio: "Reads the maps, picks the detours, owns the aux.", departed: true },
  { slug: "sainttenn", name: "Saint Tenn", role: "Guest", bio: "Rolled with the crew through the early legs of the trip.", departed: true },
  { slug: "suziesmalls", name: "Suzie Smalls", role: "Guest", bio: "Joined the rig for a stretch and brought the energy.", departed: true },
];

/* ---- sponsors (from data.js SPONSORS) ---------------------------------- */
export const SPONSORS = [
  { id: "stake", name: "Stake", href: "https://stake.us/?offer=chicken&c=ChickenAndy", tagline: "Stake Social Casino Bonus" },
  { id: "starlink", name: "Starlink", href: "https://www.starlink.com/residential?referral=RC-2915042-24191-55", tagline: "Starlink Internet Discount" },
  { id: "antiscuff", name: "AntiScuff", href: "https://antiscuff.com/clients/aff.php?aff=91", tagline: "Anti Scuff Host" },
];

export const ABOUT_RVX =
  "My name's David — 25, IRL streamer born and raised in Los Angeles, now living in Austin, Texas. " +
  "I've been streaming since 2018, mainly real-life adventure streams, traveling around and linking up " +
  "with other Kick streamers for collabs and chaos.";

/* ---- day-by-day notes (from data.js DAY_NOTES) ------------------------- */
const TRIP_START = new Date(2026, 3, 10); // 04/10/26
const MS_DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, "0");
const parse = (s: string) => {
  const [m, d, y] = s.split("/").map(Number);
  return new Date(2000 + y, m - 1, d);
};
const cityForDate = (date: Date): City => {
  for (let i = CITIES.length - 1; i >= 0; i--) if (date >= parse(CITIES[i].start)) return CITIES[i];
  return CITIES[0];
};

const DAY_NOTES: Record<number, string> = {
  1: "Wheels up. Andy picks up the rig, the crew loads in, and Austin sends us off from 6th Street.",
  3: "Last full Austin day — BBQ crawl, a failed parallel park outside Franklin, and packing the roof rack in the rain.",
  5: "I-10 East. Eight hours of highway and the first \"WE LIVE IN A VAN\" meltdown. Rolled into New Orleans after dark.",
  9: "Quarter day. Brass band took over the stream on Frenchmen St; Krispy lost the bet. Cop knocked on the RV at 2AM — all good.",
  14: "Swamp tour. A gator followed the boat for half a mile. Beignet count: 40 (Ryan, alone).",
  21: "Goodbye NOLA → hello Gulf. The long bridge run to Tampa with the sunset behind us.",
  33: "Boat day. Everything that could go wrong did — engine, anchor, Cam's phone. Greatest stream of the leg.",
  47: "Generator died mid-stream, crew streamed by powerbank candle-light. Starlink held the line.",
  53: "Tampa wrap → I-4 to Orlando. The rig hit 10,000 trip miles outside Lakeland.",
  57: "Theme-park week begins. Andy vs the teacup ride. Cam finally drives (a golf cart).",
  62: "Last Orlando night — packing up for the run down to South Florida.",
  77: "I-95 south into Miami. Palm trees, causeways, and the marina lot for the final leg.",
  84: "Live most evenings from South Beach — map updates as we roll. The Gulf Run's last chapter.",
};

export type TimelineDay = { day: number; date: string; city: string; note: string };

export function buildTimeline(): TimelineDay[] {
  return Object.keys(DAY_NOTES)
    .map(Number)
    .sort((a, b) => a - b)
    .map((day) => {
      const d = new Date(TRIP_START.getTime() + (day - 1) * MS_DAY);
      const c = cityForDate(d);
      return {
        day,
        date: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)}`,
        city: `${c.name}, ${c.region}`,
        note: DAY_NOTES[day],
      };
    });
}
