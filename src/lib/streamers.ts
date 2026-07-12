import type { Streamer } from "./types";

/* =============================================================================
   Streamer roster — 113 Kick channels extracted from chickenandy.vercel.app
   (the live directory) on 2026-07-02.

   Live/offline status, viewer counts, avatars, categories, bios and socials are
   NOT hard-coded here — they hydrate live from Kick's public channel endpoint in
   the browser (see lib/kick.ts). This file is only the static roster + which
   members belong to the featured "RV crew".
   ========================================================================== */

/** Featured RV crew (the "FEATURED / RV CREW" rail on the live site). */
const CREW = new Set([
  "chickenandy",
  "chickenandytv",
  "kikikrazy",
  "krispyw",
  "toneirl",
  "m1kedanger",
]);

/** Special guest travelling with the crew. */
const GUEST = new Set<string>([]);

/** Display-name casing captured from the live cards (Kick corrects on hydrate). */
const NAMES: Record<string, string> = {
  chickenandy: "ChickenAndy",
  chickenandytv: "ChickenAndyTv",
  m1kedanger: "M1keDanger",
  kikikrazy: "kikikrazy",
  krispyw: "KrispyW",
  ryanheinz: "ryanheinz",
  tazo: "Tazo",
  toneirl: "ToneIRL",
  wvagabond: "wvagabond",
  ac7ionman: "Ac7ionMan",
  santamaria: "Santamaria",
  cristravels: "CRISTRAVELS",
  nanatty: "nanatty",
  amouranth: "Amouranth",
  suspendas: "Suspendas",
  boneclinks: "boneclinks",
  mruktikktokofficial: "mruktikktokofficial",
  sweeterin: "SweetErin",
  zuesirl: "ZuesIRL",
  oceanadventures: "oceanadventures",
};

/* Unique Kick slugs (offline roster + currently-live channels).
   Rechecked against Kick 2026-07-03. A channel returns 404 while its owner is
   temporarily banned, so those slugs are KEPT in the roster — they show a
   name-only fallback until the ban lifts, then hydrate normally. Currently
   ban-404'd but retained: jacob_live, official_ebz, sainttenn, strokeoff.
   Two handle corrections where the original slug was the wrong account:
     - `floridabo` (empty squatter, 0 followers) -> `floridaboy` (verified, 13k+)
     - `kodakblack11` (gone) -> `kodakblack` (verified, 14k+, real Kodak Black) */
const SLUGS: string[] = [
  "abz", "ac7ionman", "adrianahlee", "akibell", "alchybooned", "aldito1k",
  "alexis", "aloeirl", "ambish", "amouranth", "andy", "asianandy", "attilabak",
  "bakedalaska", "beats", "bennymack", "blackassdave", "blame", "boneclinks",
  "burgerplanet", "captaincontent", "captaingee", "carldo", "catboykamilel",
  "cellfmade", "chickenandy", "chickenandytv", "cristravels", "danihru", "days",
  "deepak", "eddie", "erectdictator", "feef", "flexiefae", "floridaboy",
  "gagantv", "garydavid", "gewn", "girit", "hamptonbrando", "hanridge",
  "hyubsama", "iceposeidon", "iduncle", "iholly", "jackie", "jacob_live",
  "jandro", "jjstream", "jollyrancherzoo", "kadobell", "kangjoel", "kick_clipz",
  "kikikrazy", "kimmee", "kinocasinogaming", "kodakblack", "krispyw",
  "lifeismizzy", "lordhito", "loulz", "luplupka", "m1kedanger", "mercoffdaperc", "mhyochi",
  "minettelive", "moises", "mruktikktokofficial", "nanapips", "nanatty", "nedx",
  "nerdballertv", "nickfuentes", "nicklee", "nickwhite", "oceanadventures",
  "official_ebz", "oggeezerlive", "onesonicirl", "oumb", "peggyb", "peteyplastic",
  "pigeonvizion", "ricogotti", "ryanheinz", "sainttenn", "saltygummibear",
  "sampanday", "samxfrank", "santamaria", "shoovy", "shotime", "sjc_official",
  "stevewilldoit", "strokeoff", "suspendas", "suziesmalls", "sweatyvibin",
  "sweeterin", "taemin1998", "tazo", "thewildlatina", "toneirl", "trausi",
  "tridentchill", "vnthony", "withjenny", "woodbaby", "woozuh", "wvagabond",
  "xenathewitch", "zeroxhero", "zuesirl",
];

export const STREAMERS: Streamer[] = SLUGS.map((slug) => ({
  slug,
  name: NAMES[slug] ?? slug,
  ...(CREW.has(slug) ? { crew: true } : {}),
  ...(GUEST.has(slug) ? { guest: true } : {}),
}));

/** Crew first (in canonical order), then everyone else alphabetically. */
const CREW_ORDER = [
  "chickenandy", "chickenandytv", "kikikrazy", "krispyw", "toneirl", "m1kedanger",
];
export const CREW_STREAMERS: Streamer[] = CREW_ORDER
  .map((s) => STREAMERS.find((x) => x.slug === s))
  .filter((x): x is Streamer => Boolean(x));

export const streamerBySlug = (slug: string): Streamer | undefined =>
  STREAMERS.find((s) => s.slug.toLowerCase() === slug.toLowerCase());

export const TOTAL_STREAMERS = STREAMERS.length;
