/* Local site profile (display name + location + avatar).

   The original chickenandy.vercel.app stores this on the account. Here it is
   kept in the browser so the account settings work even before Supabase is
   configured (matching how favourites are stored locally). When a Supabase user
   IS signed in, AccountProfile also mirrors name/location into user_metadata so
   the two stay in sync (the avatar stays local — data URLs are too large for
   user_metadata). Guarded for SSR — safe to import from client components. */

export type Profile = { username: string; location: string; avatar: string };

const KEY = "ca:profile";
const EVENT = "ca:profile-updated";

const EMPTY: Profile = { username: "", location: "", avatar: "" };

export function getProfile(): Profile {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<Profile>;
    return { username: p.username ?? "", location: p.location ?? "", avatar: p.avatar ?? "" };
  } catch {
    return EMPTY;
  }
}

/** Persist the profile. Returns false when storage rejects it (quota). */
export function saveProfile(next: Profile): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  // Notify this tab (storage event only fires in *other* tabs).
  window.dispatchEvent(new CustomEvent(EVENT));
  return true;
}

/** Subscribe to profile changes (same tab via CustomEvent, other tabs via storage). */
export function onProfileChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
