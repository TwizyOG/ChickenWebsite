"use client";

import { useState } from "react";

const HUES = [28, 42, 190, 260, 320, 150];
function hue(slug: string) {
  let n = 0;
  for (const c of slug) n += c.charCodeAt(0);
  return HUES[n % HUES.length];
}

export default function Avatar({
  slug,
  name,
  src,
  size = 40,
  ring = false,
}: {
  slug: string;
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const initials = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  const dim = { width: size, height: size };
  const ringCls = ring ? "ring-2 ring-accent ring-offset-2 ring-offset-panel" : "";

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={dim}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ${ringCls}`}
      />
    );
  }

  return (
    <span
      style={{ ...dim, background: `oklch(0.35 0.09 ${hue(slug)})` }}
      className={`grid shrink-0 place-items-center rounded-full font-display text-sm font-bold text-white/90 ${ringCls}`}
      aria-label={name}
    >
      {initials}
    </span>
  );
}
