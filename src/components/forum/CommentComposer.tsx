"use client";

import { useState } from "react";
import { appOrigin, createComment, type ThreadComment } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { useMe } from "@/components/forum/useMe";
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
  // Top-level composer starts as Reddit's collapsed pill; replies open ready.
  const [expanded, setExpanded] = useState(parentId !== null || autoFocus);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me === null) return null;

  if ("signedOut" in me) {
    const origin = appOrigin();
    return (
      <div className="rounded-full border border-line bg-panel px-4 py-2.5 text-sm text-neutral-500">
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

  function cancel() {
    if (body.trim() && !window.confirm("Discard comment?")) return;
    setBody("");
    setError(null);
    if (onCancel) onCancel();
    else setExpanded(false);
  }

  async function submit() {
    const text = body.trim();
    if (!text || busy || uploading > 0) return;
    setBusy(true);
    setError(null);
    try {
      const row = await createComment(postId, parentId, text);
      setBody("");
      if (!parentId) setExpanded(false);
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
        autoFocus={expanded}
        maxLength={MAX_BODY}
        rows={parentId ? 2 : 3}
        collapsed={!expanded}
        collapsedPlaceholder="Join the conversation"
        onExpand={() => setExpanded(true)}
        onUploadingChange={setUploading}
        actions={
          <>
            <button
              type="button"
              onClick={cancel}
              className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-neutral-200 transition-colors hover:bg-white/15"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!body.trim() || busy || uploading > 0}
              onClick={submit}
              className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Commenting…" : uploading > 0 ? "Uploading…" : "Comment"}
            </button>
          </>
        }
      />
      {error && <p className="mt-1 text-sm text-mature">{error}</p>}
    </div>
  );
}
