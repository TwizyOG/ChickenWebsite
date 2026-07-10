/* Tenor v2 response mapping (pure — unit-tested without an API key). */

export type GifResult = {
  id: string;
  preview: string;
  url: string;
  width: number;
  height: number;
  alt: string;
};

export function mapTenorResults(j: unknown): GifResult[] {
  const results = Array.isArray((j as { results?: unknown[] })?.results)
    ? ((j as { results: unknown[] }).results as Record<string, unknown>[])
    : [];
  return results.flatMap((rec) => {
    const mf = (rec.media_formats ?? {}) as Record<
      string,
      { url?: string; dims?: number[] } | undefined
    >;
    const gif = mf.gif ?? mf.mediumgif;
    const tiny = mf.tinygif ?? gif;
    if (!rec.id || !gif?.url) return [];
    return [
      {
        id: String(rec.id),
        preview: String(tiny?.url ?? gif.url),
        url: String(gif.url),
        width: Number(gif.dims?.[0] ?? 0) || 0,
        height: Number(gif.dims?.[1] ?? 0) || 0,
        alt: String(rec.content_description ?? "") || "GIF",
      },
    ];
  });
}

/** Only Tenor-hosted media may be stored as a comment gif_url. */
export function isTenorMediaUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return (
      url.protocol === "https:" &&
      (url.hostname === "media.tenor.com" || url.hostname.endsWith(".tenor.com")) &&
      u.length <= 500
    );
  } catch {
    return false;
  }
}
