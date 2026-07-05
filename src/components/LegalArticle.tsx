import Link from "next/link";

/* Legal-page layout matching chickenandy.vercel.app/terms|privacy|cookies:
   back link, big uppercase title, "Last updated", intro, numbered sections with
   a gold bar beside each heading, and a contact callout box at the bottom. */

export function LegalArticle({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-faint transition hover:text-accent"
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
        Back to home
      </Link>
      <h1 className="mt-5 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-faint">Last updated: {updated}</p>
      <p className="mt-5 text-sm leading-relaxed text-dim">{intro}</p>

      <div className="mt-8 space-y-8">{children}</div>

      <div className="mt-12 rounded-xl border border-line bg-panel p-4 text-xs text-faint">
        Questions about this policy? Email{" "}
        <a href="mailto:hello@chickenandy.net" className="text-accent hover:underline">
          hello@chickenandy.net
        </a>
        .
      </div>
    </article>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-ink">
        <span className="h-4 w-1 rounded-full bg-accent" />
        {heading}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-dim">{children}</div>
    </section>
  );
}
