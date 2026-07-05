import Link from "next/link";
import { Suspense } from "react";
import Logo from "@/components/Logo";
import LoginErrorNotice from "@/components/LoginErrorNotice";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Sign in — ChickenAndy" };

/* Full-screen split login matching chickenandy.vercel.app/login: the form
   column (with the logo above it on mobile) and, on large screens, the brand
   panel with "EVERY STREAM, ONE PLACE." */

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <main className="relative flex flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-72 -translate-x-1/2 bg-[radial-gradient(60%_60%_at_50%_30%,rgba(227,178,60,0.18),transparent)] lg:hidden"
        />
        <div className="relative w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/" aria-label="ChickenAndy home">
              <Logo />
            </Link>
          </div>

          <h1 className="font-display text-2xl font-black uppercase tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-sm text-faint">Welcome back.</p>

          <Suspense fallback={null}>
            <LoginErrorNotice />
          </Suspense>

          <AuthForm />

          <p className="mt-8 text-center text-xs text-faint">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 transition hover:text-dim"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>{" "}
              Back to ChickenAndy
            </Link>
          </p>
        </div>
      </main>

      <aside className="relative hidden items-center justify-center overflow-hidden border-l border-line lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(80%_80%_at_60%_40%,rgba(227,178,60,0.14),transparent)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(135deg,#e3b23c_0_2px,transparent_2px_14px)]"
        />
        <div className="relative px-12">
          <Logo />
          <h2 className="mt-6 font-display font-black uppercase leading-[0.95] tracking-tight text-[clamp(2.25rem,1.2rem+2.4vw,3.25rem)]">
            EVERY STREAM,
            <br />
            <span className="text-accent [text-shadow:0_0_24px_rgba(227,178,60,0.55)]">
              ONE PLACE.
            </span>
          </h2>
        </div>
      </aside>
    </div>
  );
}
