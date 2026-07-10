/* Client-side upload pipeline: request signed URLs, PUT with XHR progress,
   probe dimensions before upload, resolve public URLs for rendering. */

export type PendingFile = {
  file: File;
  previewUrl: string; // object URL for the composer preview
  width: number | null;
  height: number | null;
  duration_s: number | null;
};

export type UploadTicket = { path: string; token: string; signedUrl: string };

export function mediaPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/forum-media/${storagePath}`;
}

export async function probeImage(file: File): Promise<PendingFile> {
  const previewUrl = URL.createObjectURL(file);
  const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = previewUrl;
  });
  return {
    file,
    previewUrl,
    width: dims?.w ?? null,
    height: dims?.h ?? null,
    duration_s: null,
  };
}

export async function probeVideo(file: File): Promise<PendingFile> {
  const previewUrl = URL.createObjectURL(file);
  const meta = await new Promise<{ w: number; h: number; d: number } | null>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
    v.onerror = () => resolve(null);
    v.src = previewUrl;
  });
  return {
    file,
    previewUrl,
    width: meta?.w ?? null,
    height: meta?.h ?? null,
    duration_s: meta && Number.isFinite(meta.d) ? Math.round(meta.d * 10) / 10 : null,
  };
}

export async function requestUploadTickets(
  files: { content_type: string; size: number }[],
): Promise<UploadTicket[]> {
  const r = await fetch("/api/forum/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((j as { error?: string }).error || `Upload setup failed (${r.status}).`);
  }
  return (j as { uploads: UploadTicket[] }).uploads;
}

/** PUT the file to the signed URL with progress callbacks (0..1). */
export function uploadToSignedUrl(
  ticket: UploadTicket,
  file: File,
  onProgress: (frac: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", ticket.signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Upload failed (network)."));
    xhr.send(file);
  });
}
