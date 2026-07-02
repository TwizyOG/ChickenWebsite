import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "Privacy Policy — ChickenAndy" };

export default function PrivacyPage() {
  return (
    <PagePlaceholder eyebrow="Legal" title="Privacy Policy">
      <p>
        This site has no backend and collects no personal data. The only thing stored is local to
        your browser: your 18+ confirmation and your favourited streamers (in localStorage). Clearing
        your browser storage removes both.
      </p>
      <p>
        Live stream, chat and profile data is fetched directly from Kick&apos;s public endpoints by
        your browser; their use is governed by Kick&apos;s privacy policy.
      </p>
    </PagePlaceholder>
  );
}
