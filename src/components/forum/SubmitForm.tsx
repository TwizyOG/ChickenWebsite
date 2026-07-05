"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { appOrigin, fetchFlairs, fetchMe, type Flair, type Me } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { FlairChip } from "@/components/forum/PostCard";

const MAX_TITLE = 300;
const MAX_BODY = 10_000;

export default function SubmitForm() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [flairId, setFlairId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().then(setMe);
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);

  const canPost = title.trim().length > 0 && flairId != null && !busy;

  async function submit() {
    if (!canPost) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), flair_id: flairId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Posting failed (${r.status}).`);
      router.push(`/community/post?id=${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (me === null) {
    return <div className="h-48 animate-pulse rounded-xl border border-line bg-panel" />;
  }

  if ("signedOut" in me) {
    const origin = appOrigin();
    return (
      <div className="rounded-xl border border-line bg-panel p-8 text-center">
        <h2 className="text-lg font-bold">Sign in to post</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">
          Posting, voting and commenting use your Kick account.
        </p>
        {origin ? (
          <a
            href={`${origin}/community/submit`}
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
          >
            Sign in on chickenwebsite.vercel.app
          </a>
        ) : kickLoginConfigured() ? (
          <button
            type="button"
            onClick={() => startKickLogin()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft"
          >
            Sign in with Kick
          </button>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">Kick login isn&apos;t configured here.</p>
        )}
      </div>
    );
  }

  if (me.ban) {
    return (
      <div className="rounded-xl border border-mature/40 bg-mature/10 p-6">
        <h2 className="font-bold text-neutral-100">You&apos;re banned from the forum</h2>
        <p className="mt-1 text-sm text-neutral-400">
          {me.ban.reason || "No reason given."}{" "}
          {me.ban.expires_at
            ? `The ban lifts on ${new Date(me.ban.expires_at).toLocaleDateString()}.`
            : "This ban is permanent."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Flair <span className="text-accent">*</span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {flairs.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFlairId(flairId === f.id ? null : f.id)}
            className={`rounded-full transition ${flairId === f.id ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100"}`}
          >
            <FlairChip name={f.name} color={f.color} />
          </button>
        ))}
        {!flairs.length && (
          <p className="text-sm text-neutral-600">Flairs unavailable — is the database set up?</p>
        )}
      </div>

      <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Title <span className="text-accent">*</span>
      </label>
      <input
        value={title}
        maxLength={MAX_TITLE}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="An interesting title"
        className="mt-2 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
      />
      <p className="mt-1 text-right text-[11px] text-neutral-600">
        {title.length}/{MAX_TITLE}
      </p>

      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Body <span className="text-neutral-600">(optional)</span>
      </label>
      <textarea
        value={body}
        maxLength={MAX_BODY}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="Text (optional)"
        className="mt-2 w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
      />

      {error && <p className="mt-3 text-sm text-mature">{error}</p>}

      <div className="mt-4 flex items-center justify-end gap-3">
        <Link href="/community" className="text-sm font-semibold text-neutral-400 hover:text-neutral-200">
          Cancel
        </Link>
        <button
          type="button"
          disabled={!canPost}
          onClick={submit}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-accent-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
