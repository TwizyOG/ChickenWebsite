"use client";

import { useEffect, useMemo, useState } from "react";
import {
  mediaForCity,
  parseMDY,
  RVX_TODAY,
  type City,
  type Media,
} from "@/lib/rvx";
import { fmtCount } from "@/lib/kick";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const pad2 = (n: number) => String(n).padStart(2, "0");

function MediaRow({ m }: { m: Media }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-elevated p-2 transition hover:border-accent/40">
      <span
        className="relative grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-md"
        style={{
          background: `linear-gradient(135deg, oklch(0.5 0.13 ${m.thumbHue}), oklch(0.26 0.07 ${m.thumbHue}))`,
        }}
      >
        <span className="font-display text-sm font-black text-white/70">RV✕</span>
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
          {m.duration}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{m.title}</span>
        <span className="mt-0.5 block text-[11px] text-faint">
          {m.date} · {m.channel} · {fmtCount(m.views)} views
        </span>
      </span>
    </div>
  );
}

/** Click-a-city sheet: every VOD & clip captured while the crew was parked at
    this stop, with a stay-calendar to narrow to a single day. */
export default function CityMedia({ city, onClose }: { city: City; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { vods, clips } = useMemo(() => mediaForCity(city.id), [city.id]);
  const media = useMemo(() => [...vods, ...clips], [vods, clips]);

  const stayStart = parseMDY(city.start);
  const stayEnd = city.end ? parseMDY(city.end) : RVX_TODAY;

  // Months this stay spans (calendar pages through them).
  const months = useMemo(() => {
    const out: { y: number; m: number; label: string }[] = [];
    for (
      let d = new Date(stayStart.getFullYear(), stayStart.getMonth(), 1);
      d <= stayEnd;
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    ) {
      out.push({
        y: d.getFullYear(),
        m: d.getMonth(),
        label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
      });
    }
    return out.length ? out : [{ y: stayStart.getFullYear(), m: stayStart.getMonth(), label: "" }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.id]);
  const [mi, setMi] = useState(0);
  const month = months[Math.min(mi, months.length - 1)];

  const countByDate = useMemo(() => {
    const map: Record<string, { v: number; c: number }> = {};
    for (const it of media) {
      const e = (map[it.date] ??= { v: 0, c: 0 });
      if (it.kind === "vod") e.v++;
      else e.c++;
    }
    return map;
  }, [media]);

  const cells = useMemo(() => {
    const startPad = new Date(month.y, month.m, 1).getDay();
    const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
    const out: ({ day: number; date: string; v: number; c: number; inStay: boolean } | null)[] = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(month.y, month.m, d);
      const ds = `${pad2(month.m + 1)}/${pad2(d)}/${String(month.y).slice(2)}`;
      const counts = countByDate[ds] ?? { v: 0, c: 0 };
      out.push({
        day: d,
        date: ds,
        v: counts.v,
        c: counts.c,
        inStay: date >= stayStart && date <= stayEnd,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, countByDate]);

  const toTime = (ds: string) => parseMDY(ds).getTime();
  const shownVods = useMemo(
    () => (picked ? vods.filter((m) => m.date === picked) : vods).slice().sort((a, b) => toTime(b.date) - toTime(a.date)),
    [vods, picked],
  );
  const shownClips = useMemo(
    () => (picked ? clips.filter((m) => m.date === picked) : clips).slice().sort((a, b) => b.views - a.views),
    [clips, picked],
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`VODs and clips from ${city.name}`}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <header className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-accent">
              Stop {pad2(city.stop)} · {city.start} → {city.end || "now"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold uppercase">
              {city.name}, {city.region}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-dim">{city.blurb}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {city.status === "current" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-live/15 px-2.5 py-1 text-[10px] font-semibold text-live">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
                Live here
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full border border-line text-faint transition hover:text-ink"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="grid gap-6 overflow-y-auto p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* left: stay calendar */}
          <div>
            <div className="rounded-xl border border-line bg-elevated p-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setMi((i) => Math.max(0, i - 1))}
                  disabled={mi === 0}
                  className="grid h-7 w-7 place-items-center rounded-full border border-line text-dim transition hover:text-ink disabled:opacity-30"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <span className="font-display text-sm font-bold uppercase">{month.label}</span>
                <button
                  onClick={() => setMi((i) => Math.min(months.length - 1, i + 1))}
                  disabled={mi >= months.length - 1}
                  className="grid h-7 w-7 place-items-center rounded-full border border-line text-dim transition hover:text-ink disabled:opacity-30"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-faint">
                {WEEKDAYS.map((w, i) => (
                  <span key={i}>{w}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((c, i) => {
                  if (c === null) return <span key={`e${i}`} />;
                  const has = c.v + c.c > 0;
                  return (
                    <button
                      key={c.date}
                      disabled={!has}
                      onClick={() => setPicked((d) => (d === c.date ? null : c.date))}
                      className={`relative grid aspect-square place-items-center rounded-md text-xs transition ${
                        picked === c.date
                          ? "bg-accent font-bold text-accent-ink"
                          : has
                            ? "bg-elevated text-ink ring-1 ring-accent/30 hover:bg-accent/20"
                            : c.inStay
                              ? "bg-accent/5 text-dim"
                              : "text-faint/40"
                      }`}
                    >
                      {c.day}
                      {has && picked !== c.date && (
                        <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-faint">
                Amber ring = media that day · tap to filter
              </p>
            </div>
          </div>

          {/* right: media lists */}
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm text-faint">
                {picked || "Entire stay"} — {shownVods.length} VODs · {shownClips.length} clips
              </span>
              {picked && (
                <button
                  onClick={() => setPicked(null)}
                  className="rounded-full border border-line px-3 py-1 text-xs text-dim transition hover:text-accent"
                >
                  Show all ✕
                </button>
              )}
            </div>

            <div className="space-y-4">
              {shownVods.length > 0 && (
                <div>
                  <div className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-accent">
                    VODs
                  </div>
                  <div className="space-y-2">
                    {shownVods.map((m) => (
                      <MediaRow key={m.id} m={m} />
                    ))}
                  </div>
                </div>
              )}
              {shownClips.length > 0 && (
                <div>
                  <div className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-accent">
                    Clips
                  </div>
                  <div className="space-y-2">
                    {shownClips.map((m) => (
                      <MediaRow key={m.id} m={m} />
                    ))}
                  </div>
                </div>
              )}
              {shownVods.length === 0 && shownClips.length === 0 && (
                <p className="rounded-xl border border-line bg-elevated p-8 text-center text-sm text-faint">
                  Nothing archived {picked ? "on that day" : "at this stop yet"}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
