import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "Store — ChickenAndy" };

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
    <PagePlaceholder eyebrow="Store" title="Store is coming soon">
      <p>Official ChickenAndy merch, limited drops and community gear are on the way.</p>
      <div className="flex flex-wrap gap-2 pt-2">
        {CATEGORIES.map((c) => (
          <span
            key={c}
            className="rounded-full border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-dim"
          >
            {c}
          </span>
        ))}
      </div>
    </PagePlaceholder>
  );
}
