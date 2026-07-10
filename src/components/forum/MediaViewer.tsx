"use client";

import { type FeedAttachment } from "@/lib/forum";
import { mediaPublicUrl } from "@/lib/forumMedia";
import VideoPlayer from "@/components/forum/VideoPlayer";
import ClipEmbed from "@/components/forum/ClipEmbed";

function ImageGallery({ images }: { images: FeedAttachment[] }) {
  if (!images.length) return null;
  if (images.length === 1) {
    const img = images[0];
    return (
      <div
        className="w-full bg-black/40"
        style={{
          aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : undefined,
          maxHeight: 640,
        }}
      >
        {/* plain img: user uploads are arbitrary remote sizes; next/image needs remote config */}
        <img
          src={mediaPublicUrl(img.storage_path ?? "")}
          alt=""
          loading="lazy"
          className="mx-auto h-full max-h-[640px] w-auto max-w-full object-contain"
        />
      </div>
    );
  }
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;
  return (
    <div className="grid grid-cols-2 gap-0.5">
      {shown.map((img, i) => (
        <a
          key={img.storage_path ?? i}
          href={mediaPublicUrl(img.storage_path ?? "")}
          target="_blank"
          rel="noreferrer"
          className="relative block aspect-square overflow-hidden bg-black/40"
        >
          <img
            src={mediaPublicUrl(img.storage_path ?? "")}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {i === shown.length - 1 && extra > 0 && (
            <span className="absolute inset-0 grid place-items-center bg-black/60 text-xl font-black text-white">
              +{extra}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

/** One consistent media frame per post: uploads and clips look identical. */
export default function MediaViewer({ attachments }: { attachments: FeedAttachment[] }) {
  if (!attachments?.length) return null;
  const sorted = [...attachments].sort((a, b) => a.position - b.position);
  const first = sorted[0];

  let content: React.ReactNode = null;
  if (first.kind === "kick_clip" || first.kind === "twitch_clip") {
    content = (
      <ClipEmbed
        provider={first.kind === "kick_clip" ? "kick" : "twitch"}
        embedId={first.embed_id ?? ""}
        url={first.url}
      />
    );
  } else if (first.kind === "video") {
    content = (
      <VideoPlayer
        src={mediaPublicUrl(first.storage_path ?? "")}
        width={first.width}
        height={first.height}
      />
    );
  } else {
    content = <ImageGallery images={sorted.filter((a) => a.kind === "image")} />;
  }

  return <div className="mt-2 overflow-hidden rounded-lg border border-line">{content}</div>;
}
