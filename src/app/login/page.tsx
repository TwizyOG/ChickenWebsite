import Link from "next/link";
import { Suspense } from "react";
import Logo from "@/components/Logo";
import KickLoginButton from "@/components/KickLoginButton";
import LoginErrorNotice from "@/components/LoginErrorNotice";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Sign in — ChickenAndy" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 sm:px-6">
      <Logo />
      <div className="mt-8 w-full rounded-2xl border border-line bg-panel p-8">
        <h1 className="font-display text-2xl font-extrabold uppercase">Sign in</h1>
        <p className="mt-1 text-sm text-dim">Welcome back.</p>

        <Suspense fallback={null}>
          <LoginErrorNotice />
        </Suspense>

        <div className="mt-6">
          <KickLoginButton />
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" />
          or with email
          <span className="h-px flex-1 bg-line" />
        </div>

        <AuthForm />
      </div>

      <Link href="/" className="mt-6 text-sm text-dim hover:text-accent">
        ← Back to ChickenAndy
      </Link>
    </div>
  );
}
