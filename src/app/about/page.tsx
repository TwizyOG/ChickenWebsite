import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "About — ChickenAndy" };

export default function AboutPage() {
  return (
    <PagePlaceholder eyebrow="About" title="About ChickenAndy">
      <p>
        ChickenAndy is a curated community hub for streamers and gaming enthusiasts — discover
        who&apos;s live across Kick and beyond, all ranked in one place.
      </p>
      <p>
        Browse featured creators, jump into live streams and chat, and keep up with the
        fastest-growing community. Built for the community, by the community.
      </p>
      <p>
        Questions or business inquiries? Reach us at{" "}
        <a href="mailto:hello@chickenandy.net" className="text-accent hover:underline">
          hello@chickenandy.net
        </a>
        .
      </p>
      <p className="text-faint">
        Fan-built directory clone — every stream and chat is embedded live from Kick&apos;s own
        public player and chat, with Kick&apos;s native 18+ gate kept intact and a site-level age
        confirmation on entry.
      </p>
    </PagePlaceholder>
  );
}
