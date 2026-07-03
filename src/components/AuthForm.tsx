"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

type Mode = "signin" | "signup" | "reset";

const TITLES: Record<Mode, { cta: string; toggle: string; switchTo: Mode }> = {
  signin: { cta: "Sign in", toggle: "Create account", switchTo: "signup" },
  signup: { cta: "Create account", toggle: "Already have an account? Sign in", switchTo: "signin" },
  reset: { cta: "Send reset link", toggle: "Back to sign in", switchTo: "signin" },
};

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);

  if (!supabaseConfigured) {
    return (
      <div className="rounded-lg border border-line bg-elevated/60 p-4 text-xs text-faint">
        Email/password sign-in isn&apos;t configured yet — set{" "}
        <code className="text-dim">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="text-dim">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in the deployment. (You can
        still sign in with Kick above.)
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/login` },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMsg({ type: "ok", text: "Account created — check your email to confirm, then sign in." });
        }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/login`,
        });
        if (error) throw error;
        setMsg({ type: "ok", text: "If that email exists, a reset link is on its way." });
      }
    } catch (err) {
      setMsg({ type: "err", text: (err as Error)?.message || "Something went wrong. Try again." });
    }
    setBusy(false);
  };

  const t = TITLES[mode];

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-faint">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent/60"
        />
      </div>

      {mode !== "reset" && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-faint">
              Password
            </label>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setMsg(null);
                }}
                className="text-[11px] text-dim hover:text-accent"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Create a password" : "Your password"}
              className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 pr-16 text-sm outline-none focus:border-accent/60"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-faint hover:text-dim"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}

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

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft disabled:opacity-60"
      >
        {busy ? "…" : t.cta}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setMode(t.switchTo);
            setMsg(null);
          }}
          className="text-xs text-dim hover:text-accent"
        >
          {t.toggle}
        </button>
      </div>
    </form>
  );
}
