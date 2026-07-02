import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "My account — ChickenAndy" };

export default function AccountPage() {
  return (
    <PagePlaceholder eyebrow="Account" title="My account">
      <p>
        Accounts and favourites sync is a demo in this build — your favourited streamers are stored
        locally in your browser. Sign-in is not wired to a real backend.
      </p>
    </PagePlaceholder>
  );
}
