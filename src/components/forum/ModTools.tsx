"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchFlairs, forumFetch, timeAgo, type Flair } from "@/lib/forum";
import { useMe } from "@/components/forum/useMe";
import { FlairChip } from "@/components/forum/PostCard";

type Tab = "queue" | "bans" | "flairs" | "roles";

type QueueData = {
  posts: {
    id: string;
    title: string;
    removal_reason: string | null;
    removed_at: string;
    author_username?: string;
    removed_by_username?: string;
  }[];
  comments: {
    id: string;
    post_id: string;
    body: string | null;
    removal_reason: string | null;
    removed_at: string;
    author_username?: string;
    removed_by_username?: string;
  }[];
  log: {
    id: number;
    action: string;
    subject_type: string | null;
    subject_id: string | null;
    detail: Record<string, unknown> | null;
    created_at: string;
    actor_username?: string;
  }[];
};

type BanRow = {
  id: number;
  username: string;
  kick_id: number | null;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  issued_by: string;
};

type UserRow = { kick_id: number; username: string; role: string; banned: boolean };

const inputCls =
  "rounded-lg border border-line bg-transparent px-3 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent";
const btnCls =
  "rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-40";

function Queue() {
  const [data, setData] = useState<QueueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    forumFetch<QueueData>("/api/forum/mod/queue").then(setData).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="mt-4 text-sm text-mature">{error}</p>;
  if (!data) return <div className="mt-4 h-32 animate-pulse rounded-lg bg-white/5" />;
  return (
    <div className="mt-4 space-y-5 text-sm">
      <section>
        <h3 className="font-bold text-neutral-200">Removed posts ({data.posts.length})</h3>
        {data.posts.length === 0 && <p className="mt-1 text-xs text-neutral-600">None.</p>}
        {data.posts.map((p) => (
          <div key={p.id} className="mt-2 rounded-lg border border-line bg-panel p-2.5 text-xs">
            <p className="font-semibold text-neutral-200">{p.title}</p>
            <p className="mt-0.5 text-neutral-500">
              by u/{p.author_username} · removed by {p.removed_by_username} · {timeAgo(p.removed_at)}{" "}
              ago · <span className="italic">{p.removal_reason}</span>
            </p>
          </div>
        ))}
      </section>
      <section>
        <h3 className="font-bold text-neutral-200">Removed comments ({data.comments.length})</h3>
        {data.comments.length === 0 && <p className="mt-1 text-xs text-neutral-600">None.</p>}
        {data.comments.map((c) => (
          <div key={c.id} className="mt-2 rounded-lg border border-line bg-panel p-2.5 text-xs">
            <p className="text-neutral-300">{c.body ?? "(gif)"}</p>
            <p className="mt-0.5 text-neutral-500">
              by u/{c.author_username} · removed by {c.removed_by_username} · {timeAgo(c.removed_at)}{" "}
              ago · <span className="italic">{c.removal_reason}</span> ·{" "}
              <Link href={`/community/post?id=${c.post_id}`} className="text-accent hover:underline">
                thread
              </Link>
            </p>
          </div>
        ))}
      </section>
      <section>
        <h3 className="font-bold text-neutral-200">Mod log</h3>
        {data.log.length === 0 && <p className="mt-1 text-xs text-neutral-600">Empty.</p>}
        {data.log.map((l) => (
          <p key={l.id} className="mt-1.5 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-300">{l.actor_username}</span>{" "}
            <span className="text-accent">{l.action}</span>
            {l.detail ? ` — ${JSON.stringify(l.detail)}` : ""} · {timeAgo(l.created_at)} ago
          </p>
        ))}
      </section>
    </div>
  );
}

function Bans() {
  const [bans, setBans] = useState<BanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    forumFetch<{ bans: BanRow[] }>("/api/forum/mod/bans")
      .then((j) => setBans(j.bans))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function lift(id: number) {
    if (!window.confirm("Lift this ban?")) return;
    try {
      await forumFetch("/api/forum/mod/bans", { method: "DELETE", body: JSON.stringify({ ban_id: id }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <p className="mt-4 text-sm text-mature">{error}</p>;
  if (!bans) return <div className="mt-4 h-24 animate-pulse rounded-lg bg-white/5" />;
  return (
    <div className="mt-4 space-y-2 text-xs">
      {bans.length === 0 && <p className="text-neutral-600">No active bans. Ban users from their posts or comments.</p>}
      {bans.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-neutral-200">u/{b.username}</p>
            <p className="mt-0.5 text-neutral-500">
              {b.reason || "no reason"} · by {b.issued_by} · {timeAgo(b.created_at)} ago ·{" "}
              {b.expires_at ? `expires ${new Date(b.expires_at).toLocaleDateString()}` : "permanent"}
            </p>
          </div>
          <button type="button" onClick={() => lift(b.id)} className={btnCls}>
            Lift
          </button>
        </div>
      ))}
    </div>
  );
}

function Flairs({ isAdmin }: { isAdmin: boolean }) {
  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchFlairs().then(setFlairs).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function create() {
    if (!name.trim()) return;
    try {
      setError(null);
      await forumFetch("/api/forum/mod/flairs", { method: "POST", body: JSON.stringify({ name, color }) });
      setName("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function rename(f: Flair) {
    const next = window.prompt("New name:", f.name);
    if (!next?.trim() || next === f.name) return;
    try {
      setError(null);
      await forumFetch("/api/forum/mod/flairs", { method: "PATCH", body: JSON.stringify({ id: f.id, name: next }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function recolor(f: Flair, c: string) {
    try {
      setError(null);
      await forumFetch("/api/forum/mod/flairs", { method: "PATCH", body: JSON.stringify({ id: f.id, color: c }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(f: Flair) {
    if (!window.confirm(`Delete the "${f.name}" flair?`)) return;
    try {
      setError(null);
      await forumFetch("/api/forum/mod/flairs", { method: "DELETE", body: JSON.stringify({ id: f.id }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!isAdmin) return <p className="mt-4 text-sm text-neutral-500">Flair management needs the admin role.</p>;
  return (
    <div className="mt-4 space-y-2 text-xs">
      {error && <p className="text-mature">{error}</p>}
      {flairs.map((f) => (
        <div key={f.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-2.5">
          <FlairChip name={f.name} color={f.color} />
          <span className="flex-1" />
          <input
            type="color"
            value={f.color}
            onChange={(e) => recolor(f, e.target.value)}
            aria-label={`${f.name} color`}
            className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent"
          />
          <button type="button" onClick={() => rename(f)} className={btnCls}>
            Rename
          </button>
          <button type="button" onClick={() => remove(f)} className={`${btnCls} hover:text-mature`}>
            Delete
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New flair name" className={`${inputCls} flex-1`} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="New flair color" className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" />
        <button type="button" onClick={create} disabled={!name.trim()} className={btnCls}>
          Add flair
        </button>
      </div>
    </div>
  );
}

function Roles({ isAdmin }: { isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) return;
    try {
      setError(null);
      const j = await forumFetch<{ users: UserRow[] }>(`/api/forum/mod/users?q=${encodeURIComponent(q.trim())}`);
      setUsers(j.users);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function setRole(u: UserRow, role: string) {
    try {
      setError(null);
      await forumFetch("/api/forum/mod/roles", { method: "POST", body: JSON.stringify({ kick_id: u.kick_id, role }) });
      setUsers((prev) => (prev ?? []).map((x) => (x.kick_id === u.kick_id ? { ...x, role } : x)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mt-4 text-xs">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search forum users by name…"
          className={`${inputCls} flex-1`}
        />
        <button type="button" onClick={search} disabled={!q.trim()} className={btnCls}>
          Search
        </button>
      </div>
      {error && <p className="mt-2 text-mature">{error}</p>}
      {users?.length === 0 && <p className="mt-3 text-neutral-600">No matches.</p>}
      {(users ?? []).map((u) => (
        <div key={u.kick_id} className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-panel p-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-neutral-200">
              u/{u.username}
              {u.banned && <span className="ml-2 rounded bg-mature/15 px-1 py-px text-[9px] font-bold uppercase text-mature">Banned</span>}
            </p>
            <p className="mt-0.5 text-neutral-500">kick id {u.kick_id}</p>
          </div>
          {isAdmin ? (
            <select
              value={u.role}
              onChange={(e) => setRole(u, e.target.value)}
              className="rounded-lg border border-line bg-panel px-2 py-1 text-xs text-neutral-200"
            >
              <option value="user">user</option>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
            </select>
          ) : (
            <span className="text-neutral-400">{u.role}</span>
          )}
        </div>
      ))}
      {!isAdmin && <p className="mt-3 text-neutral-600">Role changes need the admin role.</p>}
    </div>
  );
}

export default function ModTools() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>("queue");

  if (me === null) return <div className="h-40 animate-pulse rounded-xl border border-line bg-panel" />;
  if ("signedOut" in me || me.profile.role === "user") {
    return (
      <div className="rounded-xl border border-line bg-panel p-10 text-center">
        <p className="font-bold text-neutral-200">Mod tools need the moderator role.</p>
        <Link href="/community" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
          Back to the community feed
        </Link>
      </div>
    );
  }
  const isAdmin = me.profile.role === "admin";
  const tabs: { id: Tab; label: string }[] = [
    { id: "queue", label: "Queue" },
    { id: "bans", label: "Bans" },
    { id: "flairs", label: "Flairs" },
    { id: "roles", label: "Roles" },
  ];

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex rounded-full border border-line p-0.5 text-xs font-semibold">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-3 py-1 transition-colors ${tab === t.id ? "bg-accent text-accent-ink" : "text-neutral-400 hover:text-neutral-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "queue" && <Queue />}
      {tab === "bans" && <Bans />}
      {tab === "flairs" && <Flairs isAdmin={isAdmin} />}
      {tab === "roles" && <Roles isAdmin={isAdmin} />}
    </div>
  );
}
