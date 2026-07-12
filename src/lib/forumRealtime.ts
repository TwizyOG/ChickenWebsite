/* Server-side Realtime broadcast pings (plan 06) — content-free "something
   changed" events on public channels. Clients refetch through the masked
   views/RPCs; payloads carry ids only, so a channel snoop learns nothing
   beyond public activity. Best-effort like logMod: a lost ping just degrades
   to fetch-on-focus. */

export async function broadcastPing(
  topic: string,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* best-effort */
  }
}
