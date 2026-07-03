import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "My account — ChickenAndy" };

export default function AccountPage() {
  return (
    <PagePlaceholder eyebrow="Account" title="My account">
      <p>
        Your favourited streamers are stored locally in this browser — tap the heart on any card
        to pin it to the top of the directory.
      </p>
      <p>
        Sign in with Kick to chat in stream chats under your Kick name. Everything else is wired
        up automatically behind the scenes.
      </p>
    </PagePlaceholder>
  );
}
