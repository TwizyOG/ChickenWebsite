"use client";

import { useEffect, useRef, useState } from "react";
import { kickClipEmbedUrl, twitchClipEmbedUrl } from "@/lib/clipEmbed";

/** Official Kick/Twitch clip embed, mounted lazily when scrolled near view so
    a feed of clips doesn't load a dozen third-party players upfront. */
export default function ClipEmbed({
  provider,
  embedId,
  url,
}: {
  provider: "kick" | "twitch";
  embedId: string;
  url: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || mounted) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  const src = provider === "kick" ? kickClipEmbedUrl(embedId) : twitchClipEmbedUrl(embedId);

  return (
    <div ref={wrapRef} className="relative aspect-video w-full bg-black">
      {mounted ? (
        <iframe
          src={src}
          title={`${provider} clip`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-neutral-500">
          Loading {provider === "kick" ? "Kick" : "Twitch"} clip…
        </div>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-black/90"
        >
          Watch on {provider === "kick" ? "Kick" : "Twitch"} ↗
        </a>
      )}
    </div>
  );
}
