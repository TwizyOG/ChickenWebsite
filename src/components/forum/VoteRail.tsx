"use client";

import { useRef, useState } from "react";
import { appOrigin, castVote, type SubjectType, type VoteValue } from "@/lib/forum";
import { kickLoginConfigured, startKickLogin } from "@/lib/kickAuth";
import { useMe } from "@/components/forum/useMe";

export type VoteState = { score: number; myVote: VoteValue };

function Arrow({ down = false, active }: { down?: boolean; active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${down ? "rotate-180" : ""} ${
        active ? (down ? "text-blue-400" : "text-accent") : ""
      }`}
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 5l7 8h-4v6h-6v-6H5z" strokeLinejoin="round" />
    </svg>
  );
}

/** Parent-controlled vote widget: optimistic update, server reconcile, rollback
    on failure. Signed-out clicks start Kick login (or deep-link from the mirror). */
export default function VoteRail({
  type,
  id,
  score,
  myVote,
  onChange,
  compact = false,
}: {
  type: SubjectType;
  id: string;
  score: number;
  myVote: VoteValue;
  onChange: (next: VoteState) => void;
  compact?: boolean;
}) {
  const me = useMe();
  const busy = useRef(false);
  const [flash, setFlash] = useState(false);

  async function vote(dir: 1 | -1) {
    if (me === null) return;
    if ("signedOut" in me) {
      const origin = appOrigin();
      if (origin) window.location.href = `${origin}/community`;
      else if (kickLoginConfigured()) startKickLogin();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const prev: VoteState = { score, myVote };
    const nextVal: VoteValue = myVote === dir ? 0 : dir;
    onChange({ score: score - myVote + nextVal, myVote: nextVal });
    try {
      const res = await castVote(type, id, nextVal);
      onChange({ score: res.new_score, myVote: res.my_vote });
    } catch {
      onChange(prev);
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    } finally {
      busy.current = false;
    }
  }

  const num = (
    <span className={`text-sm font-bold ${flash ? "text-mature" : "text-neutral-200"}`}>
      {score}
    </span>
  );
  const btn =
    "rounded p-0.5 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200";

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1">
        <button type="button" aria-label="Upvote" className={btn} onClick={() => vote(1)}>
          <Arrow active={myVote === 1} />
        </button>
        {num}
        <button type="button" aria-label="Downvote" className={btn} onClick={() => vote(-1)}>
          <Arrow down active={myVote === -1} />
        </button>
      </span>
    );
  }
  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-0.5 pt-1">
      <button type="button" aria-label="Upvote" className={btn} onClick={() => vote(1)}>
        <Arrow active={myVote === 1} />
      </button>
      {num}
      <button type="button" aria-label="Downvote" className={btn} onClick={() => vote(-1)}>
        <Arrow down active={myVote === -1} />
      </button>
    </div>
  );
}
