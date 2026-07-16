/* Public files under /public (used via <img src> or CSS url()) do NOT get
   Next's basePath applied automatically — only next/link hrefs do. On the
   GitHub Pages mirror the site lives under /ChickenWebsite, so raw absolute
   srcs 404 there. next.config.ts exposes the configured base path as
   NEXT_PUBLIC_BASE_PATH (empty on Vercel/dev); prefix every public-asset
   reference through asset(). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
