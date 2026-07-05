export const metadata = { title: "About — ChickenAndy" };

/* 1:1 with chickenandy.vercel.app/about (layout re-extracted 2026-07-05):
   narrow left-aligned column, plain-case h1 with gold "ChickenAndy", two
   paragraphs, and the contact line inside a bordered bubble card. */

export default function AboutPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-2xl space-y-4 py-6">
        <h1 className="text-3xl font-black">
          About <span className="text-accent">ChickenAndy</span>
        </h1>
        <p className="text-neutral-400">
          ChickenAndy is a curated community hub for streamers and gaming enthusiasts — discover
          who&apos;s live across Kick, Twitch, YouTube and more, all ranked in one place.
        </p>
        <p className="text-neutral-400">
          Browse featured creators, jump into live streams and chat, and keep up with the
          fastest-growing community. Built for the community, by the community.
        </p>
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-neutral-400">
          Questions or business inquiries? Reach us at{" "}
          <a href="mailto:hello@chickenandy.net" className="text-accent hover:underline">
            hello@chickenandy.net
          </a>
          .
        </div>
      </div>
    </div>
  );
}
