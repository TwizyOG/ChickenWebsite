"use client";

import { useEffect, useRef, useState } from "react";
import { searchGifs, type GifResult } from "@/lib/forum";

export default function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: GifResult) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  // Tagged with the query it answers — a stale/blank query derives to "no results yet".
  const [result, setResult] = useState<{ q: string; gifs: GifResult[] | null; error: string | null }>(
    { q: "", gifs: null, error: null },
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = q.trim();
  useEffect(() => {
    if (!query) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const gifs = await searchGifs(query);
        setResult({ q: query, gifs, error: null });
      } catch (e) {
        setResult({ q: query, gifs: null, error: (e as Error).message });
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const shown = query && result.q === query ? result : { q: query, gifs: null, error: null };
  const gifs = shown.gifs;
  const error = shown.error;

  return (
    <div className="mt-2 rounded-xl border border-line bg-elevated p-3 shadow-xl">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Tenor GIFs…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
        />
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-neutral-400 hover:text-neutral-200"
        >
          Close
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-neutral-500">{error}</p>}
      {gifs !== null && gifs.length === 0 && !error && (
        <p className="mt-2 text-xs text-neutral-600">Nothing found.</p>
      )}
      {gifs && gifs.length > 0 && (
        <div className="mt-2 grid max-h-56 grid-cols-3 gap-1 overflow-y-auto">
          {gifs.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(g)}
              className="overflow-hidden rounded-md bg-black/40"
            >
              <img src={g.preview} alt={g.alt} loading="lazy" className="h-20 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-right text-[10px] text-neutral-600">Powered by Tenor</p>
    </div>
  );
}
