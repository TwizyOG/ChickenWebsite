export const metadata = { title: "Store — ChickenAndy" };

/* 1:1 with chickenandy.vercel.app/store (layout re-extracted 2026-07-05):
   centered column with the gold shopping-bag tile, plain-case h1 with gold
   "coming soon", and outlined category chips. */

const CATEGORIES = [
  "ChickenAndy Merch",
  "Limited Drops",
  "Stickers & Accessories",
  "RV & Travel",
  "Community Items",
  "Sponsor Products",
];

export default function StorePage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-3xl py-12 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" strokeLinejoin="round" />
            <path d="M3 6h18M16 10a4 4 0 0 1-8 0" strokeLinecap="round" />
          </svg>
        </span>
        <h1 className="mt-5 text-3xl font-black">
          Store is <span className="text-accent">coming soon</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-neutral-500">
          Official ChickenAndy merch, limited drops and community gear are on the way.
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
