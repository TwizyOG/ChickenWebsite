import PagePlaceholder from "@/components/PagePlaceholder";
import { TOTAL_STREAMERS } from "@/lib/streamers";

export const metadata = { title: "About — ChickenAndy" };

export default function AboutPage() {
  return (
    <PagePlaceholder eyebrow="About" title="ChickenAndy">
      <p>
        ChickenAndy is a community hub and live directory for {TOTAL_STREAMERS}+ Kick streamers —
        the RV crew, their friends, and the wider IRL/Just-Chatting scene — all watchable in one
        place with live viewer counts, previews and chat.
      </p>
      <p>
        Every stream and chat on this site is embedded live from{" "}
        <a href="https://kick.com" className="text-accent hover:underline">
          Kick
        </a>{" "}
        using Kick&apos;s own public player and chat. Age-restricted streams keep Kick&apos;s native
        18+ gate, and this site adds its own age confirmation on entry.
      </p>
      <p>
        This is a fan-built directory clone. It stores no personal data and serves no content of its
        own — it simply points you at streams that are already public on Kick.
      </p>
    </PagePlaceholder>
  );
}
