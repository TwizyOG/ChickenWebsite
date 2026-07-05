import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "About — ChickenAndy" };

/* Word-for-word copy of chickenandy.vercel.app/about (extracted 2026-07-04). */

export default function AboutPage() {
  return (
    <PagePlaceholder eyebrow="About" title="About ChickenAndy">
      <p>
        ChickenAndy is a curated community hub for streamers and gaming enthusiasts — discover
        who&apos;s live across Kick, Twitch, YouTube and more, all ranked in one place.
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
    </PagePlaceholder>
  );
}
