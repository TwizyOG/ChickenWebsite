"use client";

import { useState } from "react";
import { appOrigin, createComment, type ThreadComment } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { useMe } from "@/components/forum/useMe";

const MAX_BODY = 5_000;

export default function CommentComposer({
  postId,
  parentId = null,
  onDone,
  onCancel,
  autoFocus = false,
}: {
  postId: string;
  parentId?: string | null;
  onDone: (row: ThreadComment) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const me = useMe();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me === null) return null;

  if ("signedOut" in me) {
    const origin = appOrigin();
    return (
      <div className="rounded-lg border border-line bg-panel p-3 text-sm text-neutral-500">
        {origin ? (
          <a
            href={`${origin}/community/post?id=${postId}`}
            className="font-semibold text-accent hover:underline"
          >
            Sign in on chickenwebsite.vercel.app to join the conversation
          </a>
        ) : kickLoginConfigured() ? (
          <button
            type="button"
            onClick={() => startKickLogin()}
            className="font-semibold text-accent hover:underline"
          >
            Sign in with Kick to join the conversation
          </button>
        ) : (
          "Kick login isn't configured here."
        )}
      </div>
    );
  }

  if (me.ban) {
    return (
      <p className="rounded-lg border border-mature/40 bg-mature/10 p-3 text-sm text-neutral-400">
        You&apos;re banned from the forum{me.ban.reason ? `: ${me.ban.reason}` : "."}
      </p>
    );
  }

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const row = await createComment(postId, parentId, text);
      setBody("");
      onDone(row);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <textarea
        value={body}
        autoFocus={autoFocus}
        maxLength={MAX_BODY}
        onChange={(e) => setBody(e.target.value)}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? "Reply…" : "What are your thoughts?"}
        className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
      />
      {error && <p className="mt-1 text-sm text-mature">{error}</p>}
      <div className="mt-1.5 flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-neutral-400 hover:text-neutral-200"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={!body.trim() || busy}
          onClick={submit}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Commenting…" : "Comment"}
        </button>
      </div>
    </div>
  );
}
