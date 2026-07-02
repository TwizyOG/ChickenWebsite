/* RV X event — the single live event ported from the original site's data.js.
   Only RV X is kept (RV 7 / RV 8 archives stripped, per scope). Cities drive the
   route line, markers, popups and the driven RV animation on the map. */

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
  premise: "The 2026 Gulf Run — Austin to Orlando, streamed 24/7.",
  start: "04/10/26",
  end: null as string | null,
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
    start: "06/01/26", end: null, status: "current",
    blurb: "Current stop. Theme-park week with the whole crew.",
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
