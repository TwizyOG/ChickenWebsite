import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { bannedResponse, jsonError, requireCaller } from "@/lib/forumApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "forum-media";
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
const MAX_IMAGE_MB = 10;
const MAX_IMAGES = 6;

function maxVideoMb(): number {
  const n = Number(process.env.FORUM_MAX_VIDEO_MB);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

/** POST { files: [{ content_type, size }] } →
    { uploads: [{ path, token, signedUrl }] } — browser PUTs directly to storage. */
export async function POST(req: NextRequest) {
  const caller = await requireCaller(req);
  if (caller instanceof Response) return caller;
  const bannedRes = bannedResponse(caller.ban);
  if (bannedRes) return bannedRes;

  let raw: { files?: unknown };
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Malformed request.");
  }
  const files = Array.isArray(raw.files)
    ? (raw.files as { content_type?: unknown; size?: unknown }[])
    : [];
  if (!files.length || files.length > MAX_IMAGES) {
    return jsonError(400, "bad_files", `1-${MAX_IMAGES} files per request.`);
  }

  const kinds: ({ ext: string; video: boolean } | { error: string })[] = files.map((f) => {
    const type = String(f.content_type ?? "");
    const size = Number(f.size);
    if (IMAGE_TYPES[type]) {
      if (!(size > 0 && size <= MAX_IMAGE_MB * 1024 * 1024)) {
        return { error: `Images are limited to ${MAX_IMAGE_MB}MB.` };
      }
      return { ext: IMAGE_TYPES[type], video: false };
    }
    if (VIDEO_TYPES[type]) {
      if (!(size > 0 && size <= maxVideoMb() * 1024 * 1024)) {
        return { error: `Videos are limited to ${maxVideoMb()}MB.` };
      }
      return { ext: VIDEO_TYPES[type], video: true };
    }
    return { error: `Unsupported file type: ${type || "unknown"}.` };
  });
  const bad = kinds.find((k): k is { error: string } => "error" in k);
  if (bad) return jsonError(400, "bad_file", bad.error);
  const good = kinds as { ext: string; video: boolean }[];
  if (good.some((k) => k.video) && files.length > 1) {
    return jsonError(400, "bad_files", "A video post carries exactly one video.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonError(500, "not_configured", "Forum backend is not configured.");

  const month = new Date().toISOString().slice(0, 7); // yyyy-mm
  const uploads = [];
  for (const k of good) {
    const path = `${caller.profile.kick_id}/${month}/${randomUUID()}.${k.ext}`;
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return jsonError(500, "storage_error", error?.message ?? "Could not sign upload.");
    }
    uploads.push({ path: data.path, token: data.token, signedUrl: data.signedUrl });
  }
  return Response.json({ uploads });
}
