"use client";

import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase";

/* Live pings (plan 06): subscribe to a public broadcast topic and re-fetch on
   activity. Coalesces bursts so a voting spree causes one refetch, not ten.
   Pass coalesceMs=0 when every ping matters (e.g. counting new posts). */

export function useLiveChannel(
  topic: string | null,
  events: string[],
  onPing: (event: string, payload: Record<string, unknown>) => void,
  coalesceMs = 3000,
): void {
  const cb = useRef(onPing);
  useEffect(() => {
    cb.current = onPing;
  });
  const gate = useRef<{ last: number; timer: ReturnType<typeof setTimeout> | null }>({
    last: 0,
    timer: null,
  });
  const eventsKey = events.join(",");

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !topic) return;
    gate.current = { last: 0, timer: null };
    const fire = (event: string, payload: Record<string, unknown>) => {
      if (coalesceMs <= 0) {
        cb.current(event, payload);
        return;
      }
      const now = Date.now();
      const g = gate.current;
      if (now - g.last >= coalesceMs) {
        g.last = now;
        cb.current(event, payload);
      } else if (!g.timer) {
        g.timer = setTimeout(() => {
          g.timer = null;
          g.last = Date.now();
          cb.current(event, payload);
        }, coalesceMs - (now - g.last));
      }
    };
    let channel = sb.channel(topic);
    for (const event of eventsKey.split(",").filter(Boolean)) {
      channel = channel.on("broadcast", { event }, (msg) =>
        fire(event, ((msg as { payload?: Record<string, unknown> }).payload ?? {})),
      );
    }
    channel.subscribe();
    const g = gate.current;
    return () => {
      if (g.timer) clearTimeout(g.timer);
      g.timer = null;
      sb.removeChannel(channel);
    };
  }, [topic, eventsKey, coalesceMs]);
}
