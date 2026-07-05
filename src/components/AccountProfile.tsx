"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, displayName } from "./AuthProvider";
import { getSupabase } from "@/lib/supabase";
import { getProfile, saveProfile, type Profile } from "@/lib/profile";
import { addNotice } from "@/lib/notifications";

/* Profile page body — mirrors chickenandy.vercel.app/account:
   "Profile information" card (working avatar upload + display name + location),
   "Tags" and "Badges" coming-soon cards, and "Save changes" at the bottom. */

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif"];

function ComingSoonChip() {
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-faint">
      Coming soon
    </span>
  );
}

export default function AccountProfile() {
  const { user: siteUser } = useAuth();

  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saved, setSaved] = useState<Profile>({ username: "", location: "", avatar: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  // Load once on mount: prefer the signed-in Supabase identity, else the local profile.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const local = getProfile();
    const meta = siteUser?.user_metadata as { location?: string } | undefined;
    const initial: Profile = {
      username: displayName(siteUser) || local.username,
      location: meta?.location || local.location,
      avatar: local.avatar,
    };
    setUsername(initial.username);
    setLocation(initial.location);
    setAvatar(initial.avatar);
    setSaved(initial);
  }, [siteUser]);

  const dirty = useMemo(
    () =>
      username.trim() !== saved.username ||
      location.trim() !== saved.location ||
      avatar !== saved.avatar,
    [username, location, avatar, saved],
  );

  const initial = (username.trim()[0] || "?").toUpperCase();

  const pickAvatar = (file: File | undefined) => {
    setMsg(null);
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setMsg({ type: "err", text: "Avatar must be a JPG, PNG or GIF." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMsg({ type: "err", text: "Avatar is too large — max 5MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result || ""));
    reader.onerror = () => setMsg({ type: "err", text: "Couldn’t read that image — try another file." });
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setMsg({ type: "err", text: "Display name can’t be empty." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const next: Profile = { username: username.trim(), location: location.trim(), avatar };

    // Always persist locally so the change is reflected across the site immediately.
    if (!saveProfile(next)) {
      // Almost always the avatar blowing the localStorage quota — retry without it.
      if (avatar && saveProfile({ ...next, avatar: "" })) {
        setBusy(false);
        setAvatar("");
        setSaved({ ...next, avatar: "" });
        setMsg({
          type: "err",
          text: "Name and location saved, but that avatar is too large for browser storage — try a smaller image.",
        });
        return;
      }
      setBusy(false);
      setMsg({ type: "err", text: "Couldn’t save — browser storage is unavailable." });
      return;
    }

    // If a Supabase account is signed in, mirror name/location to user_metadata too.
    if (siteUser) {
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.auth.updateUser({
          data: { username: next.username, location: next.location },
        });
        if (error) {
          setBusy(false);
          setMsg({ type: "err", text: error.message });
          return;
        }
      }
    }

    setSaved(next);
    setBusy(false);
    addNotice("account", "Profile updated");
    setMsg({ type: "ok", text: "Saved — your profile is updated across ChickenAndy." });
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {/* Profile information */}
      <section className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-dim">
          Profile information
        </h2>

        <div className="mt-6 flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt="Your avatar"
              className="h-16 w-16 shrink-0 rounded-full border border-accent/50 object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent font-display text-2xl font-black text-accent-ink"
            >
              {initial}
            </span>
          )}
          <div>
            <input
              ref={fileInput}
              type="file"
              accept={AVATAR_TYPES.join(",")}
              className="hidden"
              aria-label="Change avatar"
              onChange={(e) => {
                pickAvatar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-dim transition hover:border-accent/50 hover:text-ink"
              >
                Change avatar
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar("")}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-faint transition hover:text-mature"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-faint">JPG, PNG or GIF. Max 5MB.</p>
          </div>
        </div>

        <div className="mt-6">
          <label
            htmlFor="displayName"
            className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-faint"
          >
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          />
        </div>

        <div className="mt-4">
          <label
            htmlFor="location"
            className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-faint"
          >
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Austin, TX"
            maxLength={60}
            className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          />
        </div>
      </section>

      {/* Tags */}
      <section className="rounded-2xl border border-line bg-panel p-6">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-widest text-dim">Tags</h2>
          <ComingSoonChip />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-faint">
          Pick the communities and interests that represent you — coming soon.
        </p>
      </section>

      {/* Badges */}
      <section className="rounded-2xl border border-line bg-panel p-6">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-widest text-dim">Badges</h2>
          <ComingSoonChip />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-faint">
          Earn badges for your achievements and milestones.
        </p>
      </section>

      {msg && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            msg.type === "err"
              ? "border-mature/40 bg-mature/10 text-mature"
              : "border-kick/40 bg-kick/10 text-kick"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !dirty}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        {!dirty && !busy && saved.username && (
          <span className="text-xs text-faint">All changes saved</span>
        )}
      </div>
    </form>
  );
}
