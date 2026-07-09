"use client";

import { useEffect, useState } from "react";
import { fetchMe, type Me } from "@/lib/forum";

/* One /api/forum/me round-trip per page load, shared by every forum widget. */

let cached: Promise<Me> | null = null;

export function getMe(): Promise<Me> {
  if (!cached) cached = fetchMe();
  return cached;
}

/** null = still loading */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let stale = false;
    getMe().then((m) => {
      if (!stale) setMe(m);
    });
    return () => {
      stale = true;
    };
  }, []);
  return me;
}
