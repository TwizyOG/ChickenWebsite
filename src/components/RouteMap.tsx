"use client";

import React from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CITIES, MAP_SOURCES as M, mediaForCity, type City } from "@/lib/rvx";
import CityMedia from "./CityMedia";

/* RV X interactive route map — ported from the original site's RouteMap.jsx.
   Free/keyless sources: CARTO dark raster, EOX satellite, Mapterhorn DEM (3D),
   OpenFreeMap glyphs, OSRM driving router (cached, arc fallback). The route line
   re-attaches on every style swap so all three modes carry it. */

const GLYPHS = M.glyphs;

function satStyle(withTerrain: boolean): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      sat: { type: "raster", tiles: [M.satTiles], tileSize: 256, attribution: M.satAttrib },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#16130f" } },
      { id: "sat", type: "raster", source: "sat", paint: { "raster-saturation": -0.12, "raster-contrast": 0.06 } },
    ],
  };
  if (withTerrain) {
    style.sources.dem = { type: "raster-dem", url: M.demUrl, attribution: "Mapterhorn" };
    style.terrain = { source: "dem", exaggeration: 1.6 };
    style.layers.push({
      id: "hills", type: "hillshade", source: "dem",
      paint: { "hillshade-shadow-color": "#241c12", "hillshade-exaggeration": 0.45 },
    });
  }
  return style;
}

function darkStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: { dark: { type: "raster", tiles: [M.darkTiles], tileSize: 256, attribution: M.darkAttrib } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#16130f" } },
      { id: "dark", type: "raster", source: "dark" },
    ],
  };
}

function bezierLeg(a: City, b: City): [number, number][] {
  const ARC: Record<string, number> = { "austin>nola": 1.1, "nola>tampa": 2.4, "tampa>orlando": 0.5, "orlando>miami": 0.35 };
  const arc = ARC[`${a.id}>${b.id}`] ?? 1;
  const c = [(a.lon + b.lon) / 2, (a.lat + b.lat) / 2 + arc];
  const pts: [number, number][] = [];
  for (let t = 0; t <= 1.0001; t += 1 / 48) {
    const u = 1 - t;
    pts.push([
      u * u * a.lon + 2 * u * t * c[0] + t * t * b.lon,
      u * u * a.lat + 2 * u * t * c[1] + t * t * b.lat,
    ]);
  }
  return pts;
}

async function fetchDrivingLegs(cities: City[]): Promise<[number, number][][]> {
  const KEY = "rvx-osrm-v3";
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(cached) && cached.length === cities.length - 1) return cached;
  } catch {
    /* refetch */
  }
  const legs = await Promise.all(
    cities.slice(1).map(async (b, i) => {
      const a = cities[i];
      const url = `${M.osrm}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`osrm ${r.status}`);
      const j = await r.json();
      const coords = j.routes?.[0]?.geometry?.coordinates;
      if (!coords || coords.length < 2) throw new Error("osrm empty");
      return coords as [number, number][];
    }),
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(legs));
  } catch {
    /* quota */
  }
  return legs;
}

const legsToFC = (legs: [number, number][][]) => ({
  type: "FeatureCollection" as const,
  features: legs.map((coords, i) => ({
    type: "Feature" as const,
    properties: { to: CITIES[i + 1].id, from: CITIES[i].id },
    geometry: { type: "LineString" as const, coordinates: coords },
  })),
});

const citiesFC = () => ({
  type: "FeatureCollection" as const,
  features: CITIES.map((c) => ({
    type: "Feature" as const,
    properties: { name: c.name },
    geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
  })),
});

export default function RouteMap() {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const legsRef = React.useRef<[number, number][][] | null>(null);
  const rvMarkerRef = React.useRef<maplibregl.Marker | null>(null);
  const animRef = React.useRef<number>(0);
  const drivenRef = React.useRef(false);

  const [mode, setMode] = React.useState<"2d" | "sat" | "3d">("sat");
  const [legs, setLegs] = React.useState<[number, number][][] | null>(null);
  const [active, setActive] = React.useState<City | null>(null);
  const [menuCity, setMenuCity] = React.useState<City | null>(null);
  const [failed, setFailed] = React.useState(false);

  const addOverlays = React.useCallback((map: maplibregl.Map) => {
    const l = legsRef.current;
    if (!l || map.getSource("rvx-route")) return;
    map.addSource("rvx-route", { type: "geojson", data: legsToFC(l) });
    map.addLayer({
      id: "rvx-route-glow", type: "line", source: "rvx-route",
      paint: { "line-color": "#E8853A", "line-width": 10, "line-blur": 8, "line-opacity": 0.55 },
    });
    map.addLayer({
      id: "rvx-route-line", type: "line", source: "rvx-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#E8853A", "line-width": 3.2 },
    });
    map.addSource("rvx-cities", { type: "geojson", data: citiesFC() });
    map.addLayer({
      id: "rvx-city-labels", type: "symbol", source: "rvx-cities",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 13.5,
        "text-letter-spacing": 0.08,
        "text-transform": "uppercase",
        "text-anchor": "bottom",
        "text-offset": [0, -0.85],
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#F6EFDC", "text-halo-color": "#16130F", "text-halo-width": 1.8 },
    });
  }, []);

  // route geometry: streets, cached; arcs as fallback
  React.useEffect(() => {
    let alive = true;
    fetchDrivingLegs(CITIES)
      .then((l) => alive && setLegs(l))
      .catch(() => alive && setLegs(CITIES.slice(1).map((b, i) => bezierLeg(CITIES[i], b))));
    return () => {
      alive = false;
    };
  }, []);

  // init map
  React.useEffect(() => {
    if (!wrapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: wrapRef.current,
        style: satStyle(false),
        center: [-89.5, 29.6],
        zoom: 5.1,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    map.on("style.load", () => addOverlays(map));

    CITIES.forEach((c) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `gl-city${c.status === "current" ? " gl-city--now" : ""}`;
      el.setAttribute("aria-label", `${c.name}, ${c.region}`);
      el.style.cssText =
        "width:16px;height:16px;border-radius:9999px;border:2px solid #0a0a0b;cursor:pointer;" +
        (c.status === "current"
          ? "background:#53fc18;box-shadow:0 0 0 4px rgba(83,252,24,.25)"
          : "background:#E3B23C");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setActive(c);
        map.easeTo({ center: [c.lon, c.lat], duration: 600 });
      });
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([c.lon, c.lat]).addTo(map);
    });

    const rvEl = document.createElement("div");
    rvEl.innerHTML = `<img src="/rv-marker.svg" alt="" draggable="false" style="width:46px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">`;
    rvMarkerRef.current = new maplibregl.Marker({ element: rvEl, anchor: "bottom", offset: [0, -36] })
      .setLngLat([CITIES[CITIES.length - 1].lon, CITIES[CITIES.length - 1].lat])
      .addTo(map);

    map.on("click", () => setActive(null));

    return () => {
      cancelAnimationFrame(animRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [addOverlays]);

  // draw + fit + drive last leg when route lands
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !legs) return;
    legsRef.current = legs;
    const ensure = () => {
      if (!mapRef.current) return;
      if (map.isStyleLoaded()) addOverlays(map);
      else setTimeout(ensure, 150);
    };
    ensure();

    const flat = legs.flat();
    const b = new maplibregl.LngLatBounds();
    flat.forEach((p) => b.extend(p));
    map.fitBounds(b, { padding: { top: 70, bottom: 60, left: 70, right: 70 }, duration: drivenRef.current ? 600 : 0 });

    const home = CITIES[CITIES.length - 1];
    if (drivenRef.current) return;
    drivenRef.current = true;
    const lastLeg = legs[legs.length - 1];
    const seg = lastLeg.slice(-Math.min(120, lastLeg.length));
    const rvMarker = rvMarkerRef.current;
    if (!rvMarker || seg.length < 2) return;
    const t0 = performance.now();
    const DUR = 2800;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DUR);
      const f = ease(t) * (seg.length - 1);
      const i = Math.max(0, Math.min(seg.length - 2, Math.floor(f)));
      const a = seg[i];
      const c = seg[i + 1] || a;
      const frac = f - i;
      rvMarker.setLngLat([a[0] + (c[0] - a[0]) * frac, a[1] + (c[1] - a[1]) * frac]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else rvMarker.setLngLat([home.lon, home.lat]);
    };
    animRef.current = requestAnimationFrame(step);
  }, [legs, addOverlays]);

  // mode switching (diff:false so overlays re-attach)
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mode === "3d") {
      map.setStyle(satStyle(true), { diff: false });
      map.once("style.load", () =>
        map.easeTo({ pitch: 58, bearing: -12, zoom: Math.max(map.getZoom(), 6.4), duration: 900 }),
      );
    } else if (mode === "sat") {
      map.setStyle(satStyle(false), { diff: false });
      map.once("style.load", () => map.easeTo({ pitch: 0, bearing: 0, duration: 700 }));
    } else {
      map.setStyle(darkStyle(), { diff: false });
      map.once("style.load", () => map.easeTo({ pitch: 0, bearing: 0, duration: 700 }));
    }
  }, [mode]);

  const activeMedia = active ? mediaForCity(active.id) : null;
  const activePreview = activeMedia ? [...activeMedia.vods, ...activeMedia.clips].slice(0, 3) : [];

  if (failed) {
    return (
      <div className="grid h-full place-items-center rounded-2xl border border-line bg-panel p-8 text-center text-sm text-dim">
        Map engine unavailable here — the route runs Austin → New Orleans → Tampa → Orlando.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-line">
      <div ref={wrapRef} className="h-full w-full" />

      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-bg/80 p-1 backdrop-blur">
        {([["2d", "Map"], ["sat", "Satellite"], ["3d", "3D"]] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              mode === m ? "bg-accent text-accent-ink" : "text-dim hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {active && activeMedia && (
        <div className="absolute bottom-4 left-4 z-10 w-72 rounded-xl border border-line bg-panel/95 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-bold uppercase tracking-widest text-accent">
              Stop {String(active.stop).padStart(2, "0")}
              {active.status === "current" ? " · Current" : ""}
            </span>
            <button onClick={() => setActive(null)} className="text-faint hover:text-ink">
              ✕
            </button>
          </div>
          <h3 className="mt-1 font-display text-lg font-extrabold">
            {active.name}, {active.region}
          </h3>
          <p className="text-xs text-faint">
            {active.start} → {active.end || "now"}
          </p>
          <p className="mt-2 text-sm text-dim">{active.blurb}</p>

          {activePreview.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {activePreview.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMenuCity(active)}
                  className="flex w-full items-center gap-2 rounded-md border border-line bg-elevated/60 px-2 py-1.5 text-left transition hover:border-accent/40"
                >
                  <span className="rounded bg-black/50 px-1 text-[9px] font-bold uppercase text-accent">
                    {m.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-dim">{m.title}</span>
                  <span className="shrink-0 text-[10px] text-faint">{m.duration}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuCity(active)}
            className="mt-3 w-full rounded-full bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-wide text-accent-ink transition hover:bg-accent-soft"
          >
            {activeMedia.vods.length + activeMedia.clips.length > 0
              ? `All ${activeMedia.vods.length} VODs & ${activeMedia.clips.length} clips →`
              : "No media at this stop yet"}
          </button>
        </div>
      )}

      {menuCity && <CityMedia city={menuCity} onClose={() => setMenuCity(null)} />}
    </div>
  );
}
