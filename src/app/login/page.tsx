import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "Sign in — ChickenAndy" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 sm:px-6">
      <Logo />
      <div className="mt-8 w-full rounded-2xl border border-line bg-panel p-8">
        <h1 className="font-display text-2xl font-extrabold uppercase">Sign in</h1>
        <p className="mt-1 text-sm text-dim">Sign in to chat and sync your favourites.</p>

        <button
          type="button"
          disabled
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-kick px-4 py-3 text-sm font-bold text-black opacity-90"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M3 3h5v6l4-6h6l-6 9 6 9h-6l-4-6v6H3z" />
          </svg>
          Continue with Kick
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <form className="space-y-3" action="#">
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          />
          <button
            type="button"
            disabled
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink opacity-90"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 rounded-lg border border-line bg-elevated/60 p-3 text-xs text-faint">
          Demo build — authentication is not wired to a backend. Real Kick sign-in would use OAuth
          2.1 + PKCE via id.kick.com with a serverless token exchange. Your favourites already work
          and are stored locally.
        </p>
      </div>

      <Link href="/" className="mt-6 text-sm text-dim hover:text-accent">
        ← Back to directory
      </Link>
    </div>
  );
}
