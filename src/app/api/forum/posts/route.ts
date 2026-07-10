import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { parseClipUrl } from "@/lib/clipEmbed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 300;
const MAX_BODY = 10_000;
const MAX_IMAGES = 6;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

type RawAttachment = {
  storage_path?: unknown;
  content_type?: unknown;
  width?: unknown;
  height?: unknown;
  duration_s?: unknown;
  size_bytes?: unknown;
};

export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: {
    title?: unknown;
    flair_id?: unknown;
    body?: unknown;
    attachments?: unknown;
    clip_url?: unknown;
  };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const flairId = Number(raw.flair_id);
  const clipUrl = typeof raw.clip_url === "string" ? raw.clip_url.trim() : "";
  const rawAtts = Array.isArray(raw.attachments) ? (raw.attachments as RawAttachment[]) : [];

  if (!title || title.length > MAX_TITLE) {
    return jsonError(400, "bad_title", `Title must be 1-${MAX_TITLE} characters.`);
  }
  if (body.length > MAX_BODY) {
    return jsonError(400, "bad_body", `Body is limited to ${MAX_BODY} characters.`);
  }
  if (!Number.isInteger(flairId) || flairId <= 0) {
    return jsonError(400, "bad_flair", "Pick a flair.");
  }
  if (clipUrl && rawAtts.length) {
    return jsonError(400, "bad_media", "A post has uploads or a clip link, not both.");
  }

  // ---- classify media -----------------------------------------------------
  const clip = clipUrl ? parseClipUrl(clipUrl) : null;
  if (clipUrl && !clip) {
    return jsonError(400, "bad_clip", "That doesn't look like a Kick or Twitch clip link.");
  }

  const prefix = `${caller.profile.kick_id}/`;
  const uploads = rawAtts.map((a) => ({
    storage_path: String(a.storage_path ?? ""),
    content_type: String(a.content_type ?? ""),
    width: Number.isFinite(Number(a.width)) ? Number(a.width) : null,
    height: Number.isFinite(Number(a.height)) ? Number(a.height) : null,
    duration_s: Number.isFinite(Number(a.duration_s)) ? Number(a.duration_s) : null,
    size_bytes: Number.isFinite(Number(a.size_bytes)) ? Number(a.size_bytes) : null,
  }));
  for (const u of uploads) {
    if (!u.storage_path.startsWith(prefix) || u.storage_path.includes("..")) {
      return jsonError(403, "not_yours", "Attachment path mismatch.");
    }
    if (!IMAGE_TYPES.has(u.content_type) && !VIDEO_TYPES.has(u.content_type)) {
      return jsonError(400, "bad_media", "Unsupported attachment type.");
    }
  }
  const videos = uploads.filter((u) => VIDEO_TYPES.has(u.content_type));
  const images = uploads.filter((u) => IMAGE_TYPES.has(u.content_type));
  if (videos.length > 1 || (videos.length && images.length) || images.length > MAX_IMAGES) {
    return jsonError(400, "bad_media", `Up to ${MAX_IMAGES} images or one video per post.`);
  }

  const kind = clip ? "embed" : videos.length ? "video" : images.length ? "image" : "text";

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const { data: flair } = await admin.from("flairs").select("id").eq("id", flairId).maybeSingle();
  if (!flair) return jsonError(400, "bad_flair", "That flair doesn't exist.");

  const { data: post, error } = await admin
    .from("posts")
    .insert({
      author_id: caller.profile.id,
      flair_id: flairId,
      title,
      body: body || null,
      kind,
    })
    .select("id")
    .single();
  if (error) return jsonError(500, "db_error", error.message);

  if (clip || uploads.length) {
    type MediaRow = {
      post_id: string;
      kind: string;
      position: number;
      storage_path?: string;
      content_type?: string;
      width?: number | null;
      height?: number | null;
      duration_s?: number | null;
      size_bytes?: number | null;
      embed_id?: string;
      url?: string;
    };
    const rows: MediaRow[] = clip
      ? [
          {
            post_id: post.id,
            kind: `${clip.provider}_clip`,
            embed_id: clip.id,
            url: clip.url,
            position: 0,
          },
        ]
      : uploads.map((u, i) => ({
          post_id: post.id,
          kind: VIDEO_TYPES.has(u.content_type) ? "video" : "image",
          storage_path: u.storage_path,
          content_type: u.content_type,
          width: u.width,
          height: u.height,
          duration_s: u.duration_s,
          size_bytes: u.size_bytes,
          position: i,
        }));
    const { error: mediaError } = await admin.from("media_attachments").insert(rows);
    if (mediaError) {
      await admin.from("posts").delete().eq("id", post.id); // compensate — no half-posts
      return jsonError(500, "db_error", mediaError.message);
    }
  }

  return Response.json({ id: post.id });
}
