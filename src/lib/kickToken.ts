/* Server-side Kick OAuth token introspection.
   Kick exposes token metadata (active flag + granted scopes) at
   id.kick.com/oauth/token/introspect, authenticated with the token itself.
   We use it to diagnose chat-send failures: a 403 from the chat API is only
   truly a scope problem if `chat:write` isn't in the granted scopes. */

const INTROSPECT = "https://id.kick.com/oauth/token/introspect";

export type KickTokenInfo =
  | {
      ok: true;
      active: boolean;
      tokenType: string | null;
      scopes: string[];
      exp: number | null;
    }
  | { ok: false; status: number };

export async function introspectKickToken(token: string): Promise<KickTokenInfo> {
  try {
    const r = await fetch(INTROSPECT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return { ok: false, status: r.status };
    const raw = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    // Kick may wrap the payload in { data: {...} } — accept either shape.
    const d = ((raw.data as Record<string, unknown>) ?? raw) ?? {};
    const scope = typeof d.scope === "string" ? d.scope : "";
    return {
      ok: true,
      active: Boolean(d.active),
      tokenType: typeof d.token_type === "string" ? d.token_type : null,
      scopes: scope.split(/\s+/).filter(Boolean),
      exp: typeof d.exp === "number" ? d.exp : null,
    };
  } catch {
    return { ok: false, status: 0 };
  }
}
