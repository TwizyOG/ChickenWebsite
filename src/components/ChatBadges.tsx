"use client";

import type { SubBadge } from "@/lib/types";

/* Chat badge icons in the style of Kick's chat — original SVG recreations of
   the familiar iconography (green mod sword, red host camera, verified seal,
   OG hexagon, VIP gem, founder badge, gifter gift, sidekick bolt) instead of
   the old text chips ("MOD"/"SUB"). A channel's own subscriber badges use the
   real art Kick serves for that channel (`subscriber_badges` → files.kick.com),
   picked by subscription months exactly like Kick's chat does. */

export type ChatBadgeData = { type: string; text?: string; count?: number };

const G = {
  mod: ["#7dff5c", "#2ecc0e"],
  host: ["#ff6a5f", "#e01f3d"],
  verified: ["#53fc18", "#1db954"],
  og: ["#38bdf8", "#7c3aed"],
  vip: ["#ff8ae0", "#a34bff"],
  founder: ["#ffd24a", "#ff8a00"],
  sub: ["#a5ff70", "#1db954"],
  sidekick: ["#ffe066", "#ffa500"],
  staff: ["#53fc18", "#0e9f4e"],
} as const;

function Grad({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
}

function Svg({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <span className="mr-1 inline-block h-4 w-4 shrink-0 align-text-bottom" title={title}>
      <svg viewBox="0 0 16 16" className="h-full w-full" aria-label={title} role="img">
        {children}
      </svg>
    </span>
  );
}

/* --- individual badges (16×16) --- */

function Broadcaster() {
  return (
    <Svg title="Broadcaster">
      <defs>
        <Grad id="kb-host" from={G.host[0]} to={G.host[1]} />
      </defs>
      <rect x="1" y="4" width="9.6" height="8" rx="2" fill="url(#kb-host)" />
      <path d="M11.4 7.1 15 4.7v6.6l-3.6-2.4z" fill="url(#kb-host)" />
      <circle cx="5.6" cy="8" r="1.7" fill="#fff" opacity=".92" />
    </Svg>
  );
}

function Moderator() {
  return (
    <Svg title="Moderator">
      <defs>
        <Grad id="kb-mod" from={G.mod[0]} to={G.mod[1]} />
      </defs>
      {/* sword: blade up-right, guard + grip bottom-left */}
      <path
        d="M14.9 1.1a.9.9 0 0 0-.8-.25l-3.6.65-6.1 6.1 3.9 3.9 6.1-6.1.65-3.6a.9.9 0 0 0-.15-.7z"
        fill="url(#kb-mod)"
      />
      <path
        d="M3.5 8.5 2.1 9.9l1.55 1.55-2.4 2.4 1.6 1.6 2.4-2.4L6.8 14.6l1.4-1.4z"
        fill="url(#kb-mod)"
      />
    </Svg>
  );
}

function Verified() {
  return (
    <Svg title="Verified">
      <defs>
        <Grad id="kb-ver" from={G.verified[0]} to={G.verified[1]} />
      </defs>
      {/* 8-point seal: two rounded squares, one rotated 45° */}
      <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.4" fill="url(#kb-ver)" />
      <rect
        x="2.6"
        y="2.6"
        width="10.8"
        height="10.8"
        rx="2.4"
        transform="rotate(45 8 8)"
        fill="url(#kb-ver)"
      />
      <path
        d="M5.1 8.3l2 2 3.9-4.2"
        fill="none"
        stroke="#06230b"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function OG() {
  return (
    <Svg title="OG">
      <defs>
        <Grad id="kb-og" from={G.og[0]} to={G.og[1]} />
      </defs>
      <path d="M8 .7 14.4 4.35v7.3L8 15.3 1.6 11.65v-7.3z" fill="url(#kb-og)" />
      <text
        x="8"
        y="10.6"
        textAnchor="middle"
        fontSize="6"
        fontWeight="800"
        fontFamily="inherit"
        fill="#fff"
      >
        OG
      </text>
    </Svg>
  );
}

function Vip() {
  return (
    <Svg title="VIP">
      <defs>
        <Grad id="kb-vip" from={G.vip[0]} to={G.vip[1]} />
      </defs>
      {/* faceted gem */}
      <path d="M3.4 2h9.2L15.6 6 8 14.8.4 6z" fill="url(#kb-vip)" />
      <path
        d="M.4 6h15.2M3.4 2 8 6l4.6-4M8 6v8.8"
        stroke="#fff"
        strokeWidth=".8"
        opacity=".4"
        fill="none"
      />
    </Svg>
  );
}

function Founder() {
  return (
    <Svg title="Founder">
      <defs>
        <Grad id="kb-fdr" from={G.founder[0]} to={G.founder[1]} />
      </defs>
      <path d="M8 .7 14.4 4.35v7.3L8 15.3 1.6 11.65v-7.3z" fill="url(#kb-fdr)" />
      <path d="M5.4 3.8h2.1v3l2.4-3h2.6L9.6 8l2.9 4.2H9.9L7.5 8.7V12H5.4z" fill="#2b1600" />
    </Svg>
  );
}

function Staff() {
  return (
    <Svg title="Kick staff">
      <defs>
        <Grad id="kb-staff" from={G.staff[0]} to={G.staff[1]} />
      </defs>
      <rect width="16" height="16" rx="3.5" fill="url(#kb-staff)" />
      <path d="M4.6 3h2.6v3.4L9.8 3h3l-3.6 5 3.6 5h-3L7.2 9.6V13H4.6z" fill="#08130a" />
    </Svg>
  );
}

function Sidekick() {
  return (
    <Svg title="Sidekick">
      <defs>
        <Grad id="kb-side" from={G.sidekick[0]} to={G.sidekick[1]} />
      </defs>
      <path d="M9.6.8 3 9.2h3.3L6 15.2l6.9-8.7H9.4z" fill="url(#kb-side)" />
    </Svg>
  );
}

function SubStar({ months }: { months?: number }) {
  const title = months ? `Subscriber (${months} month${months === 1 ? "" : "s"})` : "Subscriber";
  return (
    <Svg title={title}>
      <defs>
        <Grad id="kb-sub" from={G.sub[0]} to={G.sub[1]} />
      </defs>
      <path
        d="M8 .9l2.15 4.4 4.85.7-3.5 3.4.85 4.85L8 12l-4.35 2.25.85-4.85L1 6l4.85-.7z"
        fill="url(#kb-sub)"
      />
    </Svg>
  );
}

function SubGifter({ count = 1 }: { count?: number }) {
  // Tiered like Kick's gifter badges: colour steps up with total gifts.
  const tier =
    count >= 200
      ? ["#ff9d9d", "#e0243d"]
      : count >= 100
        ? ["#ffd24a", "#ff8a00"]
        : count >= 50
          ? ["#ff8ae0", "#c136d9"]
          : count >= 25
            ? ["#b6a1ff", "#6d28d9"]
            : ["#7cd7ff", "#0284c7"];
  const id = `kb-gift-${count >= 200 ? 5 : count >= 100 ? 4 : count >= 50 ? 3 : count >= 25 ? 2 : 1}`;
  return (
    <Svg title={`Sub gifter (${count} gifted)`}>
      <defs>
        <Grad id={id} from={tier[0]} to={tier[1]} />
      </defs>
      <rect x="1.6" y="6.4" width="12.8" height="8.4" rx="1.6" fill={`url(#${id})`} />
      <rect x="1" y="3.6" width="14" height="3.2" rx="1" fill={`url(#${id})`} />
      <rect x="6.9" y="3.6" width="2.2" height="11.2" fill="#fff" opacity=".55" />
      <path
        d="M8 3.6C7 1.4 4.4.9 3.8 2.2c-.5 1.1 1.4 1.8 4.2 1.4zm0 0c1-2.2 3.6-2.7 4.2-1.4.5 1.1-1.4 1.8-4.2 1.4z"
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

/** Channel subscriber badge: the real art for this channel from Kick, picked
    by months (highest tier the subscriber has reached), like Kick's chat. */
function ChannelSub({ months = 1, subBadges }: { months?: number; subBadges: SubBadge[] }) {
  let src: string | null = null;
  for (const b of subBadges) if (months >= b.months) src = b.src;
  if (!src) return <SubStar months={months} />;
  return (
    <img
      src={src}
      alt="Subscriber"
      title={`Subscriber (${months} month${months === 1 ? "" : "s"})`}
      loading="lazy"
      className="mr-1 inline-block h-4 w-4 shrink-0 rounded-[3px] object-contain align-text-bottom"
    />
  );
}

function BadgeIcon({ badge, subBadges }: { badge: ChatBadgeData; subBadges: SubBadge[] }) {
  switch (badge.type) {
    case "broadcaster":
      return <Broadcaster />;
    case "moderator":
      return <Moderator />;
    case "verified":
      return <Verified />;
    case "og":
      return <OG />;
    case "vip":
      return <Vip />;
    case "founder":
      return <Founder />;
    case "staff":
      return <Staff />;
    case "sidekick":
      return <Sidekick />;
    case "subscriber":
      return <ChannelSub months={badge.count} subBadges={subBadges} />;
    case "sub_gifter":
      return <SubGifter count={badge.count} />;
    default:
      return null; // unknown/new badge types just don't render
  }
}

export default function ChatBadges({
  badges,
  subBadges,
}: {
  badges: ChatBadgeData[];
  subBadges: SubBadge[];
}) {
  return (
    <>
      {badges.map((b, i) => (
        <BadgeIcon key={`${b.type}-${i}`} badge={b} subBadges={subBadges} />
      ))}
    </>
  );
}
