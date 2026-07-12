"use client";

import { useState } from "react";
import { appOrigin, createComment, type GifResult, type ThreadComment } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { useMe } from "@/components/forum/useMe";
import GifPicker from "@/components/forum/GifPicker";
import MarkdownEditor from "@/components/forum/MarkdownEditor";

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
  const [gif, setGif] = useState<GifResult | null>(null);
  const [showPicker, setShowPicker] = useState(false);
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
    if ((!text && !gif) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const row = await createComment(postId, parentId, text, gif?.url ?? null);
      setBody("");
      setGif(null);
      setShowPicker(false);
      onDone(row);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <MarkdownEditor
        value={body}
        onChange={setBody}
        autoFocus={autoFocus}
        maxLength={MAX_BODY}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? "Reply…" : "What are your thoughts?"}
      />
      {gif && (
        <div className="relative mt-1.5 inline-block">
          <img src={gif.preview} alt={gif.alt} className="h-16 rounded-lg" />
          <button
            type="button"
            aria-label="Remove GIF"
            onClick={() => setGif(null)}
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-[10px] font-bold text-white"
          >
            ✕
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-mature">{error}</p>}
      <div className="mt-1.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="rounded border border-line px-2 py-0.5 text-[10px] font-black tracking-wide text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200"
        >
          GIF
        </button>
        <span className="flex-1" />
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
          disabled={(!body.trim() && !gif) || busy}
          onClick={submit}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Commenting…" : "Comment"}
        </button>
      </div>
      {showPicker && (
        <GifPicker
          onPick={(g) => {
            setGif(g);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
