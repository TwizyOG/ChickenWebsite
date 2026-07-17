"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { appOrigin, fetchFlairs, fetchMe, type Flair, type Me } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { parseClipUrl } from "@/lib/clipEmbed";
import {
  probeImage,
  probeVideo,
  requestUploadTickets,
  uploadToSignedUrl,
  type PendingFile,
} from "@/lib/forumMedia";
import { FlairChip } from "@/components/forum/PostCard";
import MarkdownEditor from "@/components/forum/MarkdownEditor";

const MAX_TITLE = 300;
const MAX_BODY = 10_000;
const MAX_IMAGES = 6;

export default function SubmitForm() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [flairId, setFlairId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<PendingFile[]>([]);
  const [video, setVideo] = useState<PendingFile | null>(null);
  const [clip, setClip] = useState("");
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(0);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchMe().then(setMe);
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);

  const clipParsed = clip.trim() ? parseClipUrl(clip) : null;
  const clipInvalid = Boolean(clip.trim()) && !clipParsed;
  const linkInvalid = Boolean(link.trim()) && !/^https?:\/\/\S+\.\S+/i.test(link.trim());
  const canPost =
    title.trim().length > 0 &&
    flairId != null &&
    !busy &&
    !clipInvalid &&
    !linkInvalid &&
    uploading === 0;

  async function pickImages(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setVideo(null);
    setClip("");
    setLink("");
    const room = MAX_IMAGES - images.length;
    const files = [...list].slice(0, room);
    for (const f of files) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
        setError("Images must be JPEG, PNG, WebP or GIF.");
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError("Images are limited to 10MB.");
        return;
      }
    }
    const probed = await Promise.all(files.map(probeImage));
    setImages((prev) => [...prev, ...probed].slice(0, MAX_IMAGES));
  }

  async function pickVideo(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setError(null);
    if (!/^video\/(mp4|webm)$/.test(f.type)) {
      setError("Videos must be MP4 or WebM.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("Videos are limited to 50MB.");
      return;
    }
    setImages([]);
    setClip("");
    setLink("");
    setVideo(await probeVideo(f));
  }

  function setClipLink(v: string) {
    setClip(v);
    if (v.trim()) {
      setImages([]);
      setVideo(null);
      setLink("");
    }
  }

  function setArticleLink(v: string) {
    setLink(v);
    if (v.trim()) {
      setImages([]);
      setVideo(null);
      setClip("");
    }
  }

  async function submit() {
    if (!canPost) return;
    setBusy(true);
    setError(null);
    try {
      const pending = video ? [video] : images;
      let attachments: Record<string, unknown>[] = [];
      if (pending.length) {
        const tickets = await requestUploadTickets(
          pending.map((p) => ({ content_type: p.file.type, size: p.file.size })),
        );
        await Promise.all(
          tickets.map((t, i) =>
            uploadToSignedUrl(t, pending[i].file, (frac) =>
              setProgress((prev) => ({ ...prev, [pending[i].previewUrl]: frac })),
            ),
          ),
        );
        attachments = tickets.map((t, i) => ({
          storage_path: t.path,
          content_type: pending[i].file.type,
          width: pending[i].width,
          height: pending[i].height,
          duration_s: pending[i].duration_s,
          size_bytes: pending[i].file.size,
        }));
      }

      const r = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          flair_id: flairId,
          attachments,
          clip_url: clipParsed ? clip.trim() : "",
          link_url: !linkInvalid ? link.trim() : "",
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Posting failed (${r.status}).`);
      router.push(`/community/post?id=${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (me === null) {
    return <div className="h-48 animate-pulse rounded-xl border border-line bg-panel" />;
  }

  if ("signedOut" in me) {
    const origin = appOrigin();
    return (
      <div className="rounded-xl border border-line bg-panel p-8 text-center">
        <h2 className="text-lg font-bold">Sign in to post</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">
          Posting, voting and commenting use your Kick account.
        </p>
        {origin ? (
          <a
            href={`${origin}/community/submit`}
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
          >
            Sign in on chickenwebsite.vercel.app
          </a>
        ) : kickLoginConfigured() ? (
          <button
            type="button"
            onClick={() => startKickLogin()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
          >
            Sign in with Kick
          </button>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">Kick login isn&apos;t configured here.</p>
        )}
      </div>
    );
  }

  if (me.ban) {
    return (
      <div className="rounded-xl border border-mature/40 bg-mature/10 p-6">
        <h2 className="font-bold text-neutral-100">You&apos;re banned from the forum</h2>
        <p className="mt-1 text-sm text-neutral-400">
          {me.ban.reason || "No reason given."}{" "}
          {me.ban.expires_at
            ? `The ban lifts on ${new Date(me.ban.expires_at).toLocaleDateString()}.`
            : "This ban is permanent."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Flair <span className="text-accent">*</span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {flairs.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFlairId(flairId === f.id ? null : f.id)}
            className={`rounded-full transition ${flairId === f.id ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100"}`}
          >
            <FlairChip name={f.name} color={f.color} />
          </button>
        ))}
        {!flairs.length && (
          <p className="text-sm text-neutral-600">Flairs unavailable — is the database set up?</p>
        )}
      </div>

      <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Title <span className="text-accent">*</span>
      </label>
      <input
        value={title}
        maxLength={MAX_TITLE}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="An interesting title"
        className="mt-2 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
      />
      <p className="mt-1 text-right text-[11px] text-neutral-600">
        {title.length}/{MAX_TITLE}
      </p>

      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Body <span className="text-neutral-600">(optional)</span>
      </label>
      <div className="mt-2">
        <MarkdownEditor
          value={body}
          onChange={setBody}
          rows={5}
          maxLength={MAX_BODY}
          placeholder="Text (optional) — supports markdown, or drop images straight in"
          onUploadingChange={setUploading}
        />
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Link <span className="text-neutral-600">(optional — article/website URL, shows a preview card)</span>
      </label>
      <input
        value={link}
        onChange={(e) => setArticleLink(e.target.value)}
        placeholder="https://example.com/article"
        className={`mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 ${linkInvalid ? "border-mature" : "border-line focus:border-accent"}`}
      />
      {linkInvalid && (
        <p className="mt-1.5 text-xs text-mature">Links must start with http:// or https://.</p>
      )}

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Media <span className="text-neutral-600">(optional — images, one video, or a clip link)</span>
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={imageInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => void pickImages(e.target.files)}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/mp4,video/webm"
          hidden
          onChange={(e) => void pickVideo(e.target.files)}
        />
        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          disabled={images.length >= MAX_IMAGES}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-40"
        >
          + Images ({images.length}/{MAX_IMAGES})
        </button>
        <button
          type="button"
          onClick={() => videoInput.current?.click()}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:border-neutral-500"
        >
          + Video
        </button>
        <input
          value={clip}
          onChange={(e) => setClipLink(e.target.value)}
          placeholder="…or paste a Kick / Twitch clip link"
          className={`min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-xs text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 ${clipInvalid ? "border-mature" : "border-line focus:border-accent"}`}
        />
      </div>
      {clipParsed && (
        <p className="mt-1.5 text-xs font-semibold text-emerald-300">
          ✓ {clipParsed.provider === "kick" ? "Kick" : "Twitch"} clip detected — it will embed in the post.
        </p>
      )}
      {clipInvalid && (
        <p className="mt-1.5 text-xs text-mature">
          That doesn&apos;t look like a Kick or Twitch clip link.
        </p>
      )}

      {(images.length > 0 || video) && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {(video ? [video] : images).map((p) => (
            <div
              key={p.previewUrl}
              className="relative overflow-hidden rounded-lg border border-line bg-black/40"
            >
              {video ? (
                <video src={p.previewUrl} muted className="aspect-square w-full object-cover" />
              ) : (
                <img src={p.previewUrl} alt="" className="aspect-square w-full object-cover" />
              )}
              <button
                type="button"
                aria-label="Remove"
                onClick={() =>
                  video ? setVideo(null) : setImages((prev) => prev.filter((x) => x !== p))
                }
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-[10px] font-bold text-white"
              >
                ✕
              </button>
              {busy && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                  <div
                    className="h-full bg-accent transition-[width]"
                    style={{ width: `${Math.round((progress[p.previewUrl] ?? 0) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-mature">{error}</p>}

      <div className="mt-4 flex items-center justify-end gap-3">
        <Link href="/community" className="text-sm font-semibold text-neutral-400 hover:text-neutral-200">
          Cancel
        </Link>
        <button
          type="button"
          disabled={!canPost}
          onClick={submit}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
