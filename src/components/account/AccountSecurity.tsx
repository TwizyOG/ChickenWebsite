"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../AuthProvider";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { addNotice } from "@/lib/notifications";

/* Security page body — mirrors chickenandy.vercel.app/account/security:
   Verify email, Change password, Two-factor authentication and Login activity
   (coming soon). Password + 2FA run against the Supabase site account. */

type Msg = { type: "ok" | "err"; text: string } | null;

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(user.length - 2, 4))}@${domain}`;
}

function Card({
  title,
  soon,
  children,
}: {
  title: string;
  soon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-dim">
          {title}
        </h2>
        {soon && (
          <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-faint">
            Coming soon
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function MsgBox({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div
      className={`mt-4 rounded-lg border p-3 text-xs ${
        msg.type === "err"
          ? "border-mature/40 bg-mature/10 text-mature"
          : "border-kick/40 bg-kick/10 text-kick"
      }`}
    >
      {msg.text}
    </div>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-faint"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 pr-11 text-sm outline-none focus:border-accent/60"
        />
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-faint transition hover:bg-panel hover:text-dim"
        >
          {show ? (
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
  );
}

export default function AccountSecurity() {
  const { user: siteUser } = useAuth();

  /* -- change password ---------------------------------------------------- */
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  /* -- email verification -------------------------------------------------- */
  const [resendBusy, setResendBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const verified = Boolean(siteUser?.email_confirmed_at);

  /* -- 2FA ------------------------------------------------------------------ */
  const [mfaState, setMfaState] = useState<"loading" | "off" | "enrolling" | "on">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMsg, setMfaMsg] = useState<Msg>(null);

  const refreshFactors = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !siteUser) {
      setMfaState("off");
      return;
    }
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error) {
      setMfaState("off");
      return;
    }
    const totp = data.totp.find((f) => f.status === "verified");
    if (totp) {
      setFactorId(totp.id);
      setMfaState("on");
    } else {
      setMfaState("off");
    }
  }, [siteUser]);

  useEffect(() => {
    refreshFactors();
  }, [refreshFactors]);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    const sb = getSupabase();
    if (!sb || !siteUser?.email) {
      setPwMsg({ type: "err", text: "Sign in with your site account to change your password." });
      return;
    }
    if (next.length < 8) {
      setPwMsg({ type: "err", text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ type: "err", text: "New passwords don’t match." });
      return;
    }
    setPwBusy(true);
    // Confirm the current password before changing it.
    const { error: authErr } = await sb.auth.signInWithPassword({
      email: siteUser.email,
      password: current,
    });
    if (authErr) {
      setPwBusy(false);
      setPwMsg({ type: "err", text: "Current password is incorrect." });
      return;
    }
    const { error } = await sb.auth.updateUser({ password: next });
    setPwBusy(false);
    if (error) {
      setPwMsg({ type: "err", text: error.message });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    addNotice("account", "Password updated");
    setPwMsg({ type: "ok", text: "Password updated." });
  };

  const resend = async () => {
    const sb = getSupabase();
    if (!sb || !siteUser?.email) return;
    setResendBusy(true);
    setEmailMsg(null);
    const { error } = await sb.auth.resend({ type: "signup", email: siteUser.email });
    setResendBusy(false);
    setEmailMsg(
      error
        ? { type: "err", text: error.message }
        : { type: "ok", text: "Verification email sent — check your inbox." },
    );
  };

  const startEnroll = async () => {
    const sb = getSupabase();
    if (!sb || !siteUser) {
      setMfaMsg({ type: "err", text: "Sign in with your site account to enable 2FA." });
      return;
    }
    setMfaBusy(true);
    setMfaMsg(null);
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp" });
    setMfaBusy(false);
    if (error || !data) {
      setMfaMsg({ type: "err", text: error?.message ?? "Couldn’t start 2FA enrollment." });
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setTotpSecret(data.totp.secret);
    setMfaState("enrolling");
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !factorId) return;
    setMfaBusy(true);
    setMfaMsg(null);
    const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setMfaBusy(false);
      setMfaMsg({ type: "err", text: chErr?.message ?? "Couldn’t verify the code." });
      return;
    }
    const { error } = await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    setMfaBusy(false);
    if (error) {
      setMfaMsg({ type: "err", text: "That code didn’t match — try again." });
      return;
    }
    setCode("");
    setQr(null);
    setTotpSecret(null);
    setMfaState("on");
    addNotice("account", "Two-factor authentication enabled");
    setMfaMsg({ type: "ok", text: "Two-factor authentication is enabled." });
  };

  const disable2fa = async () => {
    const sb = getSupabase();
    if (!sb || !factorId) return;
    setMfaBusy(true);
    setMfaMsg(null);
    const { error } = await sb.auth.mfa.unenroll({ factorId });
    setMfaBusy(false);
    if (error) {
      setMfaMsg({ type: "err", text: error.message });
      return;
    }
    setFactorId(null);
    setMfaState("off");
    addNotice("account", "Two-factor authentication disabled");
    setMfaMsg({ type: "ok", text: "Two-factor authentication is disabled." });
  };

  const needsSiteAccount = !siteUser || !supabaseConfigured;

  return (
    <div className="space-y-4">
      {/* Verify email */}
      <Card title="Verify email">
        <p className="mt-2 text-sm leading-relaxed text-faint">
          Verifying your email helps secure your account and unlocks all platform features.
        </p>
        {siteUser?.email ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink">{maskEmail(siteUser.email)}</span>
            {verified ? (
              <span className="rounded-full border border-kick/40 bg-kick/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-kick">
                Verified
              </span>
            ) : (
              <>
                <span className="rounded-full border border-mature/40 bg-mature/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mature">
                  Unverified
                </span>
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendBusy}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-dim transition hover:border-accent/50 hover:text-ink disabled:opacity-60"
                >
                  {resendBusy ? "Sending…" : "Resend verification"}
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-faint">
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            with your site account to manage email verification.
          </p>
        )}
        <MsgBox msg={emailMsg} />
      </Card>

      {/* Change password */}
      <Card title="Change password">
        <form onSubmit={changePassword} className="mt-5 space-y-4">
          <PasswordField
            id="pw-current"
            label="Current password"
            placeholder="Enter current password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <PasswordField
            id="pw-new"
            label="New password"
            placeholder="Enter new password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
          />
          <PasswordField
            id="pw-confirm"
            label="Confirm new password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={pwBusy || needsSiteAccount || !current || !next || !confirm}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft disabled:opacity-60"
          >
            {pwBusy ? "Updating…" : "Update Password"}
          </button>
          {needsSiteAccount && (
            <p className="text-xs text-faint">
              Password changes need a site account —{" "}
              <Link href="/login" className="text-accent hover:underline">
                sign in
              </Link>{" "}
              with email to use this.
            </p>
          )}
        </form>
        <MsgBox msg={pwMsg} />
      </Card>

      {/* Two-factor authentication */}
      <Card title="Two-factor authentication">
        <p className="mt-2 text-sm leading-relaxed text-faint">
          Add a 6-digit code from an authenticator app to your sign-ins.
        </p>
        <div className="mt-4">
          {mfaState === "on" ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-kick/40 bg-kick/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-kick">
                Enabled
              </span>
              <button
                type="button"
                onClick={disable2fa}
                disabled={mfaBusy}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-mature transition hover:bg-mature/10 disabled:opacity-60"
              >
                {mfaBusy ? "Working…" : "Disable 2FA"}
              </button>
            </div>
          ) : mfaState === "enrolling" ? (
            <form onSubmit={verifyEnroll} className="space-y-4">
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="2FA QR code" className="h-40 w-40 rounded-lg bg-white p-2" />
              )}
              {totpSecret && (
                <p className="text-xs text-faint">
                  Can’t scan? Enter this secret manually:{" "}
                  <code className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-dim">{totpSecret}</code>
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="6-digit code"
                  className="w-36 rounded-lg border border-line bg-elevated px-3 py-2.5 text-center text-sm tracking-[0.3em] outline-none focus:border-accent/60"
                />
                <button
                  type="submit"
                  disabled={mfaBusy || code.length !== 6}
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft disabled:opacity-60"
                >
                  {mfaBusy ? "Verifying…" : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaState("off");
                    setQr(null);
                    setTotpSecret(null);
                    setCode("");
                  }}
                  className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-dim transition hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={startEnroll}
              disabled={mfaBusy || mfaState === "loading" || needsSiteAccount}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft disabled:opacity-60"
            >
              {mfaBusy ? "Starting…" : "Enable 2FA"}
            </button>
          )}
          {needsSiteAccount && mfaState !== "on" && (
            <p className="mt-2 text-xs text-faint">
              Two-factor auth needs a site account —{" "}
              <Link href="/login" className="text-accent hover:underline">
                sign in
              </Link>{" "}
              with email to use this.
            </p>
          )}
        </div>
        <MsgBox msg={mfaMsg} />
      </Card>

      {/* Login activity */}
      <Card title="Login activity" soon>
        <p className="mt-2 text-sm leading-relaxed text-faint">
          Recent devices that accessed your account will appear here so you can spot anything
          unexpected.
        </p>
      </Card>
    </div>
  );
}
