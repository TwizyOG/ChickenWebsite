"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { STREAMERS, CREW_STREAMERS } from "@/lib/streamers";
import { hydratePool } from "@/lib/kick";
import { type LiveData, emptyLive } from "@/lib/types";

type LiveMap = Record<string, LiveData>;

const KickContext = createContext<{ live: LiveMap; ready: boolean }>({
  live: {},
  ready: false,
});

/** Order channels so the featured crew (and other hero cards) hydrate first. */
function priorityOrder(): string[] {
  const crew = CREW_STREAMERS.map((s) => s.slug);
  const rest = STREAMERS.map((s) => s.slug).filter((s) => !crew.includes(s));
  return [...crew, ...rest];
}

export function KickProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<LiveMap>({});
  const [ready, setReady] = useState(false);
  const pending = useRef<LiveMap>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      setLive((prev) => ({ ...prev, ...pending.current }));
      pending.current = {};
    }, 120);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const slugs = priorityOrder();
    hydratePool(
      slugs,
      (data) => {
        pending.current[data.slug] = data;
        scheduleFlush();
      },
      { concurrency: 6, signal: ctrl.signal },
    ).finally(() => {
      if (!ctrl.signal.aborted) {
        // final flush
        setLive((prev) => ({ ...prev, ...pending.current }));
        pending.current = {};
        setReady(true);
      }
    });
    return () => {
      ctrl.abort();
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, [scheduleFlush]);

  return <KickContext.Provider value={{ live, ready }}>{children}</KickContext.Provider>;
}

export function useKick(slug: string): LiveData {
  const { live } = useContext(KickContext);
  return live[slug] ?? emptyLive(slug);
}

export function useKickMap(): { live: LiveMap; ready: boolean } {
  return useContext(KickContext);
}
