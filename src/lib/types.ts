export type Social = { platform: string; href: string };

/** One tier of a channel's custom subscriber badge (months → art). */
export type SubBadge = { months: number; src: string };

export type Streamer = {
  slug: string;
  /** Display name; corrected to the real Kick username on hydration. */
  name: string;
  /** Part of the featured RV crew. */
  crew?: boolean;
  /** Special guest of the RV crew. */
  guest?: boolean;
};

/** Live payload hydrated from Kick's public channel endpoint (client-side). */
export type LiveData = {
  slug: string;
  /** Properly-cased Kick display name (`user.username`) — used to correct the
      static roster name once hydrated (e.g. slug "iceposeidon" → "IcePoseidon"). */
  username: string | null;
  loaded: boolean;
  live: boolean;
  viewers: number;
  title: string | null;
  category: string | null;
  categoryHistory: string[];
  mature: boolean;
  verified: boolean;
  avatar: string | null;
  /** Private `stream.kick.com` thumbnail from the channels endpoint — 403s
      off-site, so effectively unusable; kept for the /streamers avatar path. */
  thumbnail: string | null;
  /** Hotlinkable live-frame thumbnail (`images.kick.com`) from the dedicated
      `channels/{slug}/livestream` endpoint. Null when offline. Home preview. */
  liveThumbnail: string | null;
  /** Channel banner (files.kick.com) — fallback Home preview when a live
      channel's frame hasn't generated yet. */
  banner: string | null;
  followers: number | null;
  bio: string | null;
  socials: Social[];
  /** IVS HLS master playlist (`playback_url`) — the same manifest kick.com's
      own player consumes, exposing every rendition incl. 1080p60. Feeds the
      custom quality-lock player. Only meaningful while live. */
  playbackUrl: string | null;
  /** Chatroom id for the Pusher chat socket. */
  chatroomId: number | null;
  /** Channel subscriber badges (files.kick.com art), sorted by months asc. */
  subBadges: SubBadge[];
  failed?: boolean;
};

export function emptyLive(slug: string): LiveData {
  return {
    slug,
    username: null,
    loaded: false,
    live: false,
    viewers: 0,
    title: null,
    category: null,
    categoryHistory: [],
    mature: false,
    verified: false,
    avatar: null,
    thumbnail: null,
    liveThumbnail: null,
    banner: null,
    followers: null,
    bio: null,
    socials: [],
    playbackUrl: null,
    chatroomId: null,
    subBadges: [],
  };
}
