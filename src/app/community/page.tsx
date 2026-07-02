import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "Community — ChickenAndy" };

export default function CommunityPage() {
  return (
    <PagePlaceholder eyebrow="Community" title="Community">
      <p>
        Clips, events, giveaways and the crew&apos;s Discord live here. This section of the directory
        is still being built out.
      </p>
      <p>
        In the meantime, jump into any live stream from the{" "}
        <a href="/streamers" className="text-accent hover:underline">
          directory
        </a>{" "}
        or follow the{" "}
        <a href="/map" className="text-accent hover:underline">
          RV X route
        </a>
        .
      </p>
    </PagePlaceholder>
  );
}
