/* Legacy Tenor helpers. The GIF picker was removed in forum plan 07; only the
   gif_url validator survives so old comments (and the comments API's legacy
   gif_url parameter) keep working. */

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
