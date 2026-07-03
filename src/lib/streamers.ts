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
  "chickenandytv",
  "kikikrazy",
  "krispyw",
  "ryanheinz",
  "tazo",
  "toneirl",
]);

/** Special guest travelling with the crew. */
const GUEST = new Set(["oceanadventures"]);

/** Display-name casing captured from the live cards (Kick corrects on hydrate). */
const NAMES: Record<string, string> = {
  chickenandytv: "ChickenAndyTv",
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
   Rechecked against Kick 2026-07-03: five original slugs 404'd (channel gone
   or renamed). `kodakblack11` was the real Kodak Black under a new handle and
   is corrected to `kodakblack` (verified, 14k+ followers). The other four had
   no confident match on Kick — only tiny unrelated accounts — so rather than
   fabricate an identity they're dropped (a 404 channel can never show a real
   avatar/name): jacob_live, official_ebz, sainttenn, strokeoff. Re-add here if
   their current handles are known. */
const SLUGS: string[] = [
  "abz", "ac7ionman", "adrianahlee", "akibell", "alchybooned", "aldito1k",
  "alexis", "aloeirl", "ambish", "amouranth", "andy", "asianandy", "attilabak",
  "bakedalaska", "beats", "bennymack", "blackassdave", "blame", "boneclinks",
  "burgerplanet", "captaincontent", "captaingee", "carldo", "catboykamilel",
  "cellfmade", "chickenandy", "chickenandytv", "cristravels", "danihru", "days",
  "deepak", "eddie", "erectdictator", "feef", "flexiefae", "floridabo",
  "gagantv", "garydavid", "gewn", "girit", "hamptonbrando", "hanridge",
  "hyubsama", "iceposeidon", "iduncle", "iholly", "jackie",
  "jandro", "jjstream", "jollyrancherzoo", "kadobell", "kangjoel", "kick_clipz",
  "kikikrazy", "kimmee", "kinocasinogaming", "kodakblack", "krispyw",
  "lifeismizzy", "lordhito", "loulz", "luplupka", "mercoffdaperc", "mhyochi",
  "minettelive", "moises", "mruktikktokofficial", "nanapips", "nanatty", "nedx",
  "nerdballertv", "nickfuentes", "nicklee", "nickwhite", "oceanadventures",
  "oggeezerlive", "onesonicirl", "oumb", "peggyb", "peteyplastic",
  "pigeonvizion", "ricogotti", "ryanheinz", "saltygummibear",
  "sampanday", "samxfrank", "santamaria", "shoovy", "shotime", "sjc_official",
  "stevewilldoit", "suspendas", "suziesmalls", "sweatyvibin",
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
  "chickenandytv", "kikikrazy", "ryanheinz", "krispyw", "toneirl", "tazo",
  "oceanadventures",
];
export const CREW_STREAMERS: Streamer[] = CREW_ORDER
  .map((s) => STREAMERS.find((x) => x.slug === s))
  .filter((x): x is Streamer => Boolean(x));

export const streamerBySlug = (slug: string): Streamer | undefined =>
  STREAMERS.find((s) => s.slug.toLowerCase() === slug.toLowerCase());

export const TOTAL_STREAMERS = STREAMERS.length;
