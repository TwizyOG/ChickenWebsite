"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

/* Email/password auth styled to match chickenandy.vercel.app/login:
   uppercase labels, icons inside rounded-xl inputs, gold "Forgot password?"
   beside the password label, glowing uppercase submit, and the
   "New to ChickenAndy? Create account" line underneath. */

type Mode = "signin" | "signup" | "reset";

const CTA: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create account",
  reset: "Send reset link",
};

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 018 0v2.5" />
    </svg>
  );
}

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
      <div className="mt-7 rounded-xl border border-line bg-elevated/60 p-4 text-xs text-faint">
        Email/password sign-in isn&apos;t configured yet — set{" "}
        <code className="text-dim">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="text-dim">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in the deployment. You can
        still connect Kick from your account&apos;s Connected Accounts page.
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

  return (
    <>
      <form onSubmit={submit} noValidate className="mt-7 space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="auth-email" className="block text-xs font-semibold uppercase tracking-wide text-dim">
              Email
            </label>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <MailIcon />
            </span>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-line bg-elevated py-3 pl-11 pr-3.5 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(227,178,60,0.12)]"
            />
          </div>
        </div>

        {mode !== "reset" && (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="auth-password" className="block text-xs font-semibold uppercase tracking-wide text-dim">
                Password
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setMsg(null);
                  }}
                  className="text-xs font-semibold text-accent transition hover:text-accent-soft"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
                <LockIcon />
              </span>
              <input
                id="auth-password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Create a password" : "Your password"}
                className="w-full rounded-xl border border-line bg-elevated py-3 pl-11 pr-11 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(227,178,60,0.12)]"
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-faint transition hover:bg-panel hover:text-dim"
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M2 12s3.5-7 10-7c1.8 0 3.4.5 4.8 1.2M22 12s-3.5 7-10 7c-1.8 0-3.4-.5-4.8-1.2M3 3l18 18" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div
            className={`rounded-xl border p-3 text-xs ${
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-accent-ink shadow-[0_0_22px_rgba(227,178,60,0.3)] transition duration-200 hover:shadow-[0_0_34px_rgba(227,178,60,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {busy ? "…" : CTA[mode]}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-faint">
        {mode === "signin" && (
          <>
            New to ChickenAndy?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMsg(null);
              }}
              className="font-semibold text-accent hover:underline"
            >
              Create account
            </button>
          </>
        )}
        {mode === "signup" && (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setMsg(null);
              }}
              className="font-semibold text-accent hover:underline"
            >
              Sign in
            </button>
          </>
        )}
        {mode === "reset" && (
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setMsg(null);
            }}
            className="font-semibold text-accent hover:underline"
          >
            Back to sign in
          </button>
        )}
      </p>
    </>
  );
}
