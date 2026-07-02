import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "Community — ChickenAndy" };

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
    <PagePlaceholder eyebrow="Community" title="Community is coming soon">
      <p>
        A place to talk RV life, streams, clips and everything ChickenAndy — even when streams are
        offline.
      </p>
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
