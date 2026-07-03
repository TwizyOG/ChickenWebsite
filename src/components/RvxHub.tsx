"use client";

import { useState } from "react";
import { RVX_EVENT, CITIES, CREW, SPONSORS, ABOUT_RVX, buildTimeline, type CrewMember } from "@/lib/rvx";
import { useKick } from "./KickProvider";
import { fmtCount } from "@/lib/kick";
import Avatar from "./Avatar";
import MapEmbed from "./MapEmbed";
import RvxMedia from "./RvxMedia";
import { KickBadge, VerifiedBadge } from "./ui";

const TABS = ["Map", "Timeline", "Clips & VODs", "Crew"] as const;
type Tab = (typeof TABS)[number];

function CrewCard({ member }: { member: CrewMember }) {
  const live = useKick(member.slug ?? "__none__");
  const hasChannel = Boolean(member.slug);
  return (
    <div className="rounded-card border border-line bg-elevated p-4">
      <div className="flex items-center gap-3">
        <Avatar slug={member.slug ?? member.name} name={member.name} src={hasChannel ? live.avatar : null} size={48} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-sm font-bold">{member.name}</h3>
            {hasChannel && live.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
          </div>
          <p className="text-xs text-accent">{member.role}</p>
        </div>
        {hasChannel && live.live && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-[10px] font-semibold text-live">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
            {fmtCount(live.viewers)}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-dim">{member.bio}</p>
      <div className="mt-3 flex items-center gap-2">
        {member.departed && (
          <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wide text-faint">
            Past crew
          </span>
        )}
        {hasChannel && (
          <a
            href={`https://kick.com/${member.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-kick hover:underline"
          >
            <KickBadge />
          </a>
        )}
      </div>
    </div>
  );
}

export default function RvxHub() {
  const [tab, setTab] = useState<Tab>("Map");
  const timeline = buildTimeline();

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
                  c.status === "current" ? "bg-kick/15 text-kick" : "bg-elevated text-dim"
                }`}
              >
                {c.name}
              </span>
              {i < CITIES.length - 1 && <span className="text-faint">→</span>}
            </span>
          ))}
        </div>
      </header>

      <nav className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2.5 text-sm font-semibold transition ${
              tab === t ? "text-accent" : "text-dim hover:text-ink"
            }`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "Map" && (
          <div className="h-[72vh]">
            <MapEmbed />
          </div>
        )}

        {tab === "Timeline" && (
          <div className="relative mx-auto max-w-2xl">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-line" aria-hidden />
            <ol className="space-y-6">
              {timeline.map((d) => (
                <li key={d.day} className="relative pl-10">
                  <span className="absolute left-1.5 top-1 grid h-3 w-3 place-items-center rounded-full bg-accent ring-4 ring-bg" />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-display text-sm font-extrabold text-accent">Day {d.day}</span>
                    <span className="text-xs text-faint">{d.date}</span>
                    <span className="text-xs font-semibold text-dim">{d.city}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-dim">{d.note}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {tab === "Clips & VODs" && <RvxMedia />}

        {tab === "Crew" && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CREW.map((m) => (
                <div key={m.name} className="rise">
                  <CrewCard member={m} />
                </div>
              ))}
            </div>

            <div className="mt-10">
              <h2 className="font-display text-lg font-extrabold uppercase">About the trip</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dim">{ABOUT_RVX}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {SPONSORS.map((s) => (
                  <a
                    key={s.id}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-line bg-elevated px-3 py-1.5 text-xs text-dim transition hover:border-accent/50 hover:text-accent"
                  >
                    {s.name} · <span className="text-faint">{s.tagline}</span>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
