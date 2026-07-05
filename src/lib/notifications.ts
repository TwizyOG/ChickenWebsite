/* Notification feed backing /account/notifications ("You'll be notified when a
   favorite goes live and for account updates"). Stored in localStorage so it
   works without a backend; FavoriteLiveWatcher adds "live" entries and the
   account pages add "account" entries. SSR-guarded. */

export type Notice = {
  id: string;
  kind: "live" | "account";
  text: string;
  /** Optional second line (live shows e.g. "Complete your profile."). */
  sub?: string;
  at: number;
  read: boolean;
};

const KEY = "ca:notices";
const SEEN_KEY = "ca:notices-live-seen";
const WELCOME_KEY = "ca:welcome-seeded";
const EVENT = "ca:notices-updated";
const MAX = 50;

export function getNotices(): Notice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Notice[]) : [];
  } catch {
    return [];
  }
}

function write(list: Notice[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage full — drop silently */
  }
}

export function addNotice(kind: Notice["kind"], text: string, sub?: string): void {
  if (typeof window === "undefined") return;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  write([{ id, kind, text, ...(sub ? { sub } : {}), at: Date.now(), read: false }, ...getNotices()]);
}

/** One-time "Welcome to ChickenAndy!" notice, matching the live site. */
export function seedWelcome(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(WELCOME_KEY)) return;
    window.localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    return;
  }
  addNotice("account", "Welcome to ChickenAndy!", "Complete your profile.");
}

export function timeAgo(at: number): string {
  const s = Math.max(1, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function markAllRead(): void {
  if (typeof window === "undefined") return;
  const list = getNotices();
  if (!list.some((n) => !n.read)) return;
  write(list.map((n) => ({ ...n, read: true })));
}

export function unreadCount(): number {
  return getNotices().filter((n) => !n.read).length;
}

export function onNoticesChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/* -- go-live dedupe: one notice per favorite per live session ------------- */

export function getLiveSeen(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setLiveSeen(map: Record<string, true>): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
