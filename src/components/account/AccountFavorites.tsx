"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STREAMERS } from "@/lib/streamers";
import { useFavourites } from "@/lib/useFavourites";
import { useKickMap } from "../KickProvider";
import StreamerCard from "../StreamerCard";
import StreamerDetail from "../StreamerDetail";
import type { Streamer } from "@/lib/types";

/* Favorite Streamers page body — mirrors chickenandy.vercel.app/account/favorites.
   Fully working: reads the same ★ favorites store used by every streamer card
   (toggling the star on a card here removes it), cards hydrate live from Kick. */

export default function AccountFavorites() {
  const { favs } = useFavourites();
  const { live } = useKickMap();
  const [detail, setDetail] = useState<Streamer | null>(null);

  const list = useMemo(() => {
    const picked = STREAMERS.filter((s) => favs.has(s.slug));
    return picked.sort((a, b) => {
      const la = live[a.slug]?.live ? 1 : 0;
      const lb = live[b.slug]?.live ? 1 : 0;
      if (la !== lb) return lb - la;
      const va = live[a.slug]?.viewers ?? 0;
      const vb = live[b.slug]?.viewers ?? 0;
      if (va !== vb) return vb - va;
      return a.name.localeCompare(b.name);
    });
  }, [favs, live]);

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-10 text-center">
        <p className="font-semibold text-ink">You haven&apos;t favorited anyone yet.</p>
        <p className="mt-1 text-sm text-faint">Tap the ★ on any streamer to add them here.</p>
        <Link
          href="/streamers"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-accent-ink transition hover:bg-accent-soft"
        >
          Browse streamers
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-faint">
        {list.length} favorite{list.length === 1 ? "" : "s"} — tap the ★ on a card to remove it.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {list.map((s) => (
          <div key={s.slug} className="rise">
            <StreamerCard streamer={s} onInfo={setDetail} />
          </div>
        ))}
      </div>
      {detail && <StreamerDetail streamer={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
