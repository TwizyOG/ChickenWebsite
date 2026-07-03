"use client";

import { useMemo, useState } from "react";
import { RVX_CLIPS, RVX_VODS, tripMonths, type Media } from "@/lib/rvx";
import { fmtCount } from "@/lib/kick";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function MediaCard({ m }: { m: Media }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-elevated transition hover:border-accent/40">
      <div
        className="relative aspect-video"
        style={{
          background: `linear-gradient(135deg, oklch(0.5 0.13 ${m.thumbHue}), oklch(0.26 0.07 ${m.thumbHue}))`,
        }}
      >
        <span className="absolute inset-0 grid place-items-center font-display text-xl font-black text-white/75">
          RV✕
        </span>
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
          {m.kind}
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {m.duration}
        </span>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{m.title}</h3>
        <div className="mt-1.5 flex items-center justify-between text-xs text-faint">
          <span className="truncate">{m.channel}</span>
          <span className="shrink-0">{fmtCount(m.views)} views</span>
        </div>
        <div className="mt-0.5 text-[11px] text-faint">
          {m.date} · {m.city}
        </div>
      </div>
    </div>
  );
}

export default function RvxMedia() {
  const [kind, setKind] = useState<"clips" | "vods">("clips");
  const months = useMemo(() => tripMonths(), []);
  const [monthIdx, setMonthIdx] = useState(Math.max(0, months.length - 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const items = kind === "clips" ? RVX_CLIPS : RVX_VODS;

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) map[it.date] = (map[it.date] || 0) + 1;
    return map;
  }, [items]);

  const month = months[monthIdx] ?? { y: 2026, m: 3, label: "April 2026" };

  const cells = useMemo(() => {
    const startPad = new Date(month.y, month.m, 1).getDay();
    const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
    const out: ({ day: number; date: string; count: number } | null)[] = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${String(month.m + 1).padStart(2, "0")}/${String(d).padStart(2, "0")}/${String(month.y).slice(2)}`;
      out.push({ day: d, date: ds, count: countByDate[ds] || 0 });
    }
    return out;
  }, [month, countByDate]);

  const shown = useMemo(() => {
    const base = selectedDate ? items.filter((m) => m.date === selectedDate) : items;
    const toTime = (ds: string) => {
      const [mm, dd, yy] = ds.split("/").map(Number);
      return new Date(2000 + yy, mm - 1, dd).getTime();
    };
    return [...base].sort((a, b) => toTime(b.date) - toTime(a.date));
  }, [items, selectedDate]);

  const changeKind = (k: "clips" | "vods") => {
    setKind(k);
    setSelectedDate(null);
  };
  const changeMonth = (dir: number) => {
    setMonthIdx((i) => Math.min(months.length - 1, Math.max(0, i + dir)));
    setSelectedDate(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* left: toggle + calendar */}
      <div>
        <div className="inline-flex rounded-full border border-line bg-elevated p-1">
          {(["clips", "vods"] as const).map((k) => (
            <button
              key={k}
              onClick={() => changeKind(k)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                kind === k ? "bg-accent text-accent-ink" : "text-dim hover:text-ink"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => changeMonth(-1)}
              disabled={monthIdx === 0}
              className="grid h-7 w-7 place-items-center rounded-full border border-line text-dim transition hover:text-ink disabled:opacity-30"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="font-display text-sm font-bold uppercase">{month.label}</span>
            <button
              onClick={() => changeMonth(1)}
              disabled={monthIdx === months.length - 1}
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
            {cells.map((c, i) =>
              c === null ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  disabled={c.count === 0}
                  onClick={() => setSelectedDate((d) => (d === c.date ? null : c.date))}
                  className={`relative grid aspect-square place-items-center rounded-md text-xs transition ${
                    selectedDate === c.date
                      ? "bg-accent font-bold text-accent-ink"
                      : c.count > 0
                        ? "bg-elevated text-ink hover:bg-accent/20"
                        : "text-faint/50"
                  }`}
                >
                  {c.day}
                  {c.count > 0 && selectedDate !== c.date && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />
                  )}
                </button>
              ),
            )}
          </div>

          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="mt-3 w-full rounded-full border border-line py-1.5 text-xs text-dim transition hover:text-accent"
            >
              Clear day filter
            </button>
          )}
        </div>
      </div>

      {/* right: grid */}
      <div>
        <p className="mb-4 text-sm text-faint">
          {selectedDate ? `${shown.length} on ${selectedDate}` : `All ${shown.length} ${kind}`} · newest
          first {!selectedDate && "· pick a day to filter"}
        </p>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-line bg-elevated p-8 text-center text-sm text-faint">
            No {kind} {selectedDate ? "on that day" : "this month"}.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((m) => (
              <div key={m.id} className="rise">
                <MediaCard m={m} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
