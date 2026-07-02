export type Social = { platform: string; href: string };

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
  loaded: boolean;
  live: boolean;
  viewers: number;
  title: string | null;
  category: string | null;
  categoryHistory: string[];
  mature: boolean;
  verified: boolean;
  avatar: string | null;
  thumbnail: string | null;
  followers: number | null;
  bio: string | null;
  socials: Social[];
  failed?: boolean;
};

export function emptyLive(slug: string): LiveData {
  return {
    slug,
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
    followers: null,
    bio: null,
    socials: [],
  };
}
