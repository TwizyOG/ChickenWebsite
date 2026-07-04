"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtCount } from "@/lib/kick";
import {
  fetchActiveCrewMedia,
  fmtDuration,
  type MediaResult,
  type RvxMediaItem,
} from "@/lib/rvxMedia";
import RvxMediaPlayer from "./RvxMediaPlayer";
import { MatureBadge } from "./ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type Month = { y: number; m: number; label: string };

/** On-brand gradient fallback hue when a real thumbnail is missing/broken. */
function hueFor(id: string): number {
  let n = 0;
  for (const c of id) n += c.charCodeAt(0);
  return 30 + (n % 300);
}

function monthLabel(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** Months spanned by the real media (min → max), so the calendar pages through
    exactly the months that actually have crew clips/VODs. */
function monthsFromMedia(items: RvxMediaItem[]): Month[] {
  const times = items.map((m) => m.time).filter((t) => t > 0);
  if (!times.length) {
    const now = new Date();
    return [{ y: now.getFullYear(), m: now.getMonth(), label: monthLabel(now.getFullYear(), now.getMonth()) }];
  }
  const start = new Date(Math.min(...times));
  const end = new Date(Math.max(...times));
  const out: Month[] = [];
  for (
    let d = new Date(start.getFullYear(), start.getMonth(), 1);
    d <= end;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    out.push({ y: d.getFullYear(), m: d.getMonth(), label: monthLabel(d.getFullYear(), d.getMonth()) });
  }
  return out;
}

function MediaCard({ m, onOpen }: { m: RvxMediaItem; onOpen: (m: RvxMediaItem) => void }) {
  const [broken, setBroken] = useState(false);
  const showImg = m.thumbnail && !broken;
  return (
    <button
      type="button"
      onClick={() => onOpen(m)}
      className="group/card block w-full overflow-hidden rounded-card border border-line bg-elevated text-left transition hover:border-accent/40"
    >
      <div
        className="relative aspect-video"
        style={
          showImg
            ? undefined
            : { background: `linear-gradient(135deg, oklch(0.5 0.13 ${hueFor(m.id)}), oklch(0.26 0.07 ${hueFor(m.id)}))` }
        }
      >
        {showImg ? (
          <img
            src={m.thumbnail!}
            alt={m.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-display text-xl font-black text-white/75">
            RV✕
          </span>
        )}

        {/* play affordance */}
        <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover/card:bg-black/30">
          <span className="grid h-12 w-12 translate-y-1 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition group-hover/card:translate-y-0 group-hover/card:opacity-100">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </span>

        <span className="absolute left-2 top-2 flex items-center gap-1">
          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
            {m.kind}
          </span>
          {m.mature && <MatureBadge />}
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {fmtDuration(m.durationSec)}
        </span>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{m.title}</h3>
        <div className="mt-1.5 flex items-center justify-between text-xs text-faint">
          <span className="truncate text-kick">{m.channelName}</span>
          <span className="shrink-0">{fmtCount(m.views)} views</span>
        </div>
        <div className="mt-0.5 text-[11px] text-faint">{m.date}</div>
      </div>
    </button>
  );
}

export default function RvxMedia() {
  const [media, setMedia] = useState<MediaResult>({ clips: [], vods: [] });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [kind, setKind] = useState<"clips" | "vods">("vods");
  const [monthIdx, setMonthIdx] = useState<number | null>(null); // null = latest month
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [playing, setPlaying] = useState<RvxMediaItem | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchActiveCrewMedia()
      .then((r) => {
        if (ctrl.signal.aborted) return;
        setMedia(r);
        setStatus(r.clips.length || r.vods.length ? "ready" : "error");
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus("error");
      });
    return () => ctrl.abort();
  }, []);

  const items = kind === "clips" ? media.clips : media.vods;

  // Month range stays fixed across the clips/vods toggle (union of both).
  const months = useMemo(
    () => monthsFromMedia([...media.clips, ...media.vods]),
    [media],
  );

  // Derived, not synced via an effect: null monthIdx shows the latest month; a
  // concrete index takes over once the user pages.
  const effIdx = months.length ? Math.min(monthIdx ?? months.length - 1, months.length - 1) : 0;

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) map[it.date] = (map[it.date] || 0) + 1;
    return map;
  }, [items]);

  const month = months[effIdx] ?? months[0];

  const cells = useMemo(() => {
    if (!month) return [];
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

  // Items are pre-sorted newest-first by the data layer.
  const shown = useMemo(
    () => (selectedDate ? items.filter((m) => m.date === selectedDate) : items),
    [items, selectedDate],
  );

  const changeKind = (k: "clips" | "vods") => {
    setKind(k);
    setSelectedDate(null);
  };
  const changeMonth = (dir: number) => {
    setSelectedDate(null);
    setMonthIdx(Math.min(months.length - 1, Math.max(0, effIdx + dir)));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* left: toggle + calendar */}
      <div>
        <div className="inline-flex rounded-full border border-line bg-elevated p-1">
          {(["vods", "clips"] as const).map((k) => (
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
              disabled={effIdx <= 0}
              className="grid h-7 w-7 place-items-center rounded-full border border-line text-dim transition hover:text-ink disabled:opacity-30"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="font-display text-sm font-bold uppercase">{month?.label ?? "—"}</span>
            <button
              onClick={() => changeMonth(1)}
              disabled={effIdx >= months.length - 1}
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
                  title={c.count > 0 ? `${c.count} ${kind} on ${c.date}` : undefined}
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

        <p className="mt-3 px-1 text-[11px] leading-snug text-faint">
          Real clips &amp; VODs from the active crew · dot = media that day · tap to filter
        </p>
      </div>

      {/* right: grid */}
      <div>
        <p className="mb-4 text-sm text-faint">
          {status === "loading"
            ? "Loading crew clips & VODs from Kick…"
            : selectedDate
              ? `${shown.length} ${kind} on ${selectedDate}`
              : `All ${shown.length} ${kind}`}{" "}
          {status === "ready" && "· newest first"}
          {status === "ready" && !selectedDate && " · pick a day to filter"}
        </p>

        {status === "loading" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-card border border-line bg-elevated">
                <div className="aspect-video animate-pulse bg-line/40" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-line/40" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-line/30" />
                </div>
              </div>
            ))}
          </div>
        ) : status === "error" ? (
          <p className="rounded-xl border border-line bg-elevated p-8 text-center text-sm text-faint">
            Couldn&apos;t reach Kick for the crew&apos;s clips &amp; VODs right now. Refresh to retry.
          </p>
        ) : shown.length === 0 ? (
          <p className="rounded-xl border border-line bg-elevated p-8 text-center text-sm text-faint">
            No {kind} {selectedDate ? "on that day" : "yet"}.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((m) => (
              <div key={m.id} className="rise">
                <MediaCard m={m} onOpen={setPlaying} />
              </div>
            ))}
          </div>
        )}
      </div>

      <RvxMediaPlayer item={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
