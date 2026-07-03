import PagePlaceholder from "@/components/PagePlaceholder";
import KickEventsPanel from "@/components/KickEventsPanel";

export const metadata = { title: "My account — ChickenAndy" };

export default function AccountPage() {
  return (
    <PagePlaceholder eyebrow="Account" title="My account">
      <p>
        Your favourited streamers are stored locally in your browser. Sign in with Kick to enable
        live event webhooks for your channel — they subscribe automatically on first sign-in.
      </p>
      <div className="pt-2">
        <KickEventsPanel />
      </div>
    </PagePlaceholder>
  );
}
