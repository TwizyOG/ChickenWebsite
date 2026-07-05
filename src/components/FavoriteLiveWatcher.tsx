"use client";

import { useEffect } from "react";
import { useKickMap } from "./KickProvider";
import { useFavourites } from "@/lib/useFavourites";
import { addNotice, getLiveSeen, setLiveSeen } from "@/lib/notifications";

/* Watches hydrated Kick data and pushes a notification the first time each
   favorited streamer is seen live (once per live session — the seen flag
   clears when they go offline again). Renders nothing. */

export default function FavoriteLiveWatcher() {
  const { live } = useKickMap();
  const { favs } = useFavourites();

  useEffect(() => {
    if (favs.size === 0) return;
    const seen = getLiveSeen();
    let changed = false;
    for (const slug of favs) {
      const d = live[slug];
      if (!d?.loaded) continue;
      if (d.live && !seen[slug]) {
        addNotice(
          "live",
          `${d.username || slug} is live now${d.category ? ` — ${d.category}` : ""}`,
        );
        seen[slug] = true;
        changed = true;
      } else if (!d.live && seen[slug]) {
        delete seen[slug];
        changed = true;
      }
    }
    if (changed) setLiveSeen(seen);
  }, [live, favs]);

  return null;
}
