"use client";

import { type Flair } from "@/lib/forum";

export default function FlairBar({
  flairs,
  active,
  onPick,
}: {
  flairs: Flair[];
  active: number | null;
  onPick: (id: number | null) => void;
}) {
  if (!flairs.length) return null;
  const chip = (selected: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors ${
      selected
        ? "border-accent bg-accent/15 text-accent"
        : "border-line text-neutral-300 hover:border-neutral-500"
    }`;
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip(active == null)} onClick={() => onPick(null)}>
        All
      </button>
      {flairs.map((f) => (
        <button
          key={f.id}
          type="button"
          className={chip(active === f.id)}
          onClick={() => onPick(active === f.id ? null : f.id)}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
