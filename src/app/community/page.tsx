export const metadata = { title: "Community — ChickenAndy" };

/* 1:1 with chickenandy.vercel.app/community (layout re-extracted 2026-07-05):
   centered column with the gold people tile, plain-case h1 with gold
   "coming soon", and outlined topic chips. */

const CATEGORIES = [
  "General Discussion",
  "RV Life",
  "Stream Discussion",
  "Suggestions & Feedback",
  "Clips & Media",
  "Off Topic",
  "Announcements",
];

export default function CommunityPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-3xl py-12 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0113 0M17 5a3.5 3.5 0 010 7M22 20a6.5 6.5 0 00-5-6.3" />
          </svg>
        </span>
        <h1 className="mt-5 text-3xl font-black">
          Community is <span className="text-accent">coming soon</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-neutral-500">
          A place to talk RV life, streams, clips and everything ChickenAndy — even when streams
          are offline.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <span key={c} className="rounded-full border border-line px-3 py-1.5 text-sm text-neutral-300">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
