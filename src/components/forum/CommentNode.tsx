"use client";

import { useState } from "react";
import {
  banUser,
  deleteComment,
  modRemove,
  timeAgo,
  updateComment,
  type CommentNodeData,
  type ThreadComment,
} from "@/lib/forum";
import VoteRail, { type VoteState } from "@/components/forum/VoteRail";
import CommentComposer from "@/components/forum/CommentComposer";
import UserHovercard from "@/components/forum/UserHovercard";
import ReportDialog from "@/components/forum/ReportDialog";

export type ThreadHandlers = {
  postId: string;
  myKickId: number | null;
  myRole: "user" | "moderator" | "admin" | null;
  voteState: Record<string, VoteState>;
  onVote: (id: string, next: VoteState) => void;
  onReplyDone: (row: ThreadComment) => void;
  onEdited: (row: ThreadComment) => void;
  onDeleted: (id: string) => void;
};

function RoleBadge({ role }: { role: string | null }) {
  if (role !== "moderator" && role !== "admin") return null;
  return (
    <span
      className={`rounded px-1 py-px text-[10px] font-bold uppercase ${
        role === "admin" ? "bg-accent/15 text-accent" : "bg-emerald-400/15 text-emerald-300"
      }`}
    >
      {role === "admin" ? "Admin" : "Mod"}
    </span>
  );
}

export default function CommentNode({ node, h }: { node: CommentNodeData; h: ThreadHandlers }) {
  const c = node.comment;
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  const vs = h.voteState[c.id] ?? { score: c.score, myVote: 0 as const };
  const mine = !c.removed && h.myKickId != null && c.author_kick_id === h.myKickId;
  const amMod = h.myRole === "moderator" || h.myRole === "admin";

  async function modRemoveComment() {
    const reason = window.prompt("Removal reason:");
    if (reason == null) return;
    try {
      await modRemove("comment", c.id, reason.trim());
      h.onDeleted(c.id);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function banAuthor() {
    if (c.author_kick_id == null) return;
    const reason = window.prompt(`Ban u/${c.author_username} — reason:`);
    if (reason == null) return;
    const daysRaw = window.prompt("Ban length in days (blank = permanent):", "");
    if (daysRaw == null) return;
    const days = daysRaw.trim() ? Number(daysRaw) : null;
    try {
      await banUser(c.author_kick_id, reason.trim(), Number.isFinite(days ?? NaN) ? days : null);
      window.alert(`u/${c.author_username} is banned.`);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function saveEdit() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const row = await updateComment(c.id, text);
      h.onEdited(row);
      setEditing(false);
    } catch {
      /* keep the editor open so nothing is lost */
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !window.confirm("Delete this comment?")) return;
    setBusy(true);
    try {
      await deleteComment(c.id);
      h.onDeleted(c.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3" id={`c-${c.id}`}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand thread" : "Collapse thread"}
          className="mt-0.5 shrink-0"
        >
          {c.author_avatar ? (
            <img src={c.author_avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-neutral-300">
              {(c.author_username ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            {c.removed ? (
              <span className="font-semibold text-neutral-300">[removed]</span>
            ) : (
              <UserHovercard username={c.author_username} kickId={c.author_kick_id}>
                <span className="font-semibold text-neutral-300">u/{c.author_username}</span>
              </UserHovercard>
            )}
            <RoleBadge role={c.author_role} />
            <span>·</span>
            <span>{timeAgo(c.created_at)} ago</span>
            {c.edited_at && !c.removed && <span className="italic">(edited)</span>}
            {collapsed && <span className="text-neutral-600">[+{node.children.length}]</span>}
          </div>

          {!collapsed && (
            <>
              {editing ? (
                <div className="mt-1.5">
                  <textarea
                    value={draft}
                    maxLength={5000}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent"
                  />
                  <div className="mt-1 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="text-xs font-semibold text-neutral-400 hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!draft.trim() || busy}
                      onClick={saveEdit}
                      className="rounded bg-accent px-3 py-1 text-xs font-bold text-accent-ink disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : c.removed ? (
                <p className="mt-1 text-sm italic text-neutral-600">[removed]</p>
              ) : (
                <>
                  {c.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-200">{c.body}</p>
                  )}
                  {c.gif_url && (
                    <img src={c.gif_url} alt="GIF" loading="lazy" className="mt-1.5 max-h-64 rounded-lg" />
                  )}
                </>
              )}

              {!c.removed && !editing && (
                <div className="mt-1 flex items-center gap-3 text-xs font-semibold text-neutral-500">
                  <VoteRail
                    compact
                    type="comment"
                    id={c.id}
                    score={vs.score}
                    myVote={vs.myVote}
                    onChange={(n) => h.onVote(c.id, n)}
                  />
                  <button
                    type="button"
                    onClick={() => setReplying(!replying)}
                    className="transition-colors hover:text-neutral-300"
                  >
                    Reply
                  </button>
                  {!mine && (
                    <button
                      type="button"
                      onClick={() => setReporting(true)}
                      className="transition-colors hover:text-neutral-300"
                    >
                      Report
                    </button>
                  )}
                  {mine && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(c.body ?? "");
                          setEditing(true);
                        }}
                        className="transition-colors hover:text-neutral-300"
                      >
                        Edit
                      </button>
                      <button type="button" onClick={remove} className="transition-colors hover:text-mature">
                        Delete
                      </button>
                    </>
                  )}
                  {amMod && !mine && (
                    <>
                      <button type="button" onClick={modRemoveComment} className="transition-colors hover:text-mature">
                        Remove
                      </button>
                      <button type="button" onClick={banAuthor} className="transition-colors hover:text-mature">
                        Ban
                      </button>
                    </>
                  )}
                </div>
              )}

              {reporting && (
                <ReportDialog type="comment" id={c.id} onClose={() => setReporting(false)} />
              )}

              {replying && (
                <div className="mt-2">
                  <CommentComposer
                    postId={h.postId}
                    parentId={c.id}
                    autoFocus
                    onCancel={() => setReplying(false)}
                    onDone={(row) => {
                      setReplying(false);
                      h.onReplyDone(row);
                    }}
                  />
                </div>
              )}

              {node.children.length > 0 && (
                <div className="ml-1 border-l border-line pl-3">
                  {node.children.map((child) => (
                    <CommentNode key={child.comment.id} node={child} h={h} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
