import { type NextRequest } from "next/server";
import { jsonError, logMod, requireRole } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLOR = /^#[0-9a-f]{6}$/i;

/** POST { name, color? } — create (admin). */
export async function POST(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  let raw: { name?: unknown; color?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "";
  const color = typeof raw.color === "string" && COLOR.test(raw.color) ? raw.color : "#f59e0b";
  if (!name) return jsonError(400, "bad_name", "Flair needs a name.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { data: maxPos } = await admin
    .from("flairs")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await admin
    .from("flairs")
    .insert({ name, color, position: (maxPos?.position ?? 0) + 1, created_by: caller.profile.id })
    .select("id")
    .single();
  if (error) {
    return jsonError(
      500,
      "db_error",
      error.message.includes("duplicate") ? "That flair already exists." : error.message,
    );
  }
  await logMod(caller.profile.id, "flair_create", "flair", String(data.id), { name, color });
  return Response.json({ id: data.id });
}

/** PATCH { id, name?, color? } — update (admin). */
export async function PATCH(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  let raw: { id?: unknown; name?: unknown; color?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const id = Number(raw.id);
  if (!Number.isInteger(id)) return jsonError(400, "bad_flair", "Invalid flair.");
  const patch: Record<string, unknown> = {};
  if (typeof raw.name === "string" && raw.name.trim()) patch.name = raw.name.trim().slice(0, 40);
  if (typeof raw.color === "string" && COLOR.test(raw.color)) patch.color = raw.color;
  if (!Object.keys(patch).length) return jsonError(400, "bad_patch", "Nothing to change.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { error } = await admin.from("flairs").update(patch).eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  await logMod(caller.profile.id, "flair_update", "flair", String(id), patch);
  return Response.json({ ok: true });
}

/** DELETE { id } — remove (admin), guarded when posts still use it. */
export async function DELETE(req: NextRequest) {
  const caller = await requireRole(req, "admin");
  if (caller instanceof Response) return caller;
  let raw: { id?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const id = Number(raw.id);
  if (!Number.isInteger(id)) return jsonError(400, "bad_flair", "Invalid flair.");
  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");
  const { count } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("flair_id", id);
  if ((count ?? 0) > 0) {
    return jsonError(
      400,
      "flair_in_use",
      `That flair is on ${count} post${count === 1 ? "" : "s"} — rename it instead.`,
    );
  }
  const { error } = await admin.from("flairs").delete().eq("id", id);
  if (error) return jsonError(500, "db_error", error.message);
  await logMod(caller.profile.id, "flair_delete", "flair", String(id));
  return Response.json({ ok: true });
}
