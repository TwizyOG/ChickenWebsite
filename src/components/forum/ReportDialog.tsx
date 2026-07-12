"use client";

import { useState } from "react";
import { appOrigin, reportContent, type ReportReason, type SubjectType } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { useMe } from "@/components/forum/useMe";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam or self-promotion" },
  { id: "harassment", label: "Harassment or abuse" },
  { id: "nsfw", label: "NSFW or inappropriate" },
  { id: "misinfo", label: "Misinformation" },
  { id: "other", label: "Something else" },
];

/** Modal report form. Handles its own auth gate (signed-out → Kick sign-in,
    or a deep-link to the Vercel origin from the static mirror). */
export default function ReportDialog({
  type,
  id,
  onClose,
}: {
  type: SubjectType;
  id: string;
  onClose: () => void;
}) {
  const me = useMe();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedOut = me !== null && "signedOut" in me;

  function signIn() {
    const origin = appOrigin();
    if (origin) window.location.href = `${origin}/community`;
    else if (kickLoginConfigured()) startKickLogin();
  }

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reportContent(type, id, reason, detail.trim());
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Report this ${type}`}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-4 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <p className="font-bold text-neutral-100">Reported — thanks.</p>
            <p className="mt-1 text-sm text-neutral-400">The mod team will take a look.</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft"
              >
                Close
              </button>
            </div>
          </>
        ) : signedOut ? (
          <>
            <p className="font-bold text-neutral-100">Sign in to report</p>
            <p className="mt-1 text-sm text-neutral-400">
              Reports need a Kick sign-in so the mods can weigh them.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={signIn}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft"
              >
                Sign in with Kick
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-bold text-neutral-100">Report this {type}</p>
            <div className="mt-3 space-y-1.5">
              {REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    reason === r.id
                      ? "border-accent bg-accent/10 text-neutral-100"
                      : "border-line text-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="accent-[#e3b23c]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={detail}
              maxLength={500}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              placeholder="Anything the mods should know? (optional)"
              className="mt-3 w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
            />
            {error && <p className="mt-2 text-xs text-mature">{error}</p>}
            <div className="mt-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason || busy}
                onClick={submit}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink transition hover:bg-accent-soft disabled:opacity-40"
              >
                Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
