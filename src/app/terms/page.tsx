import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "Terms of Service — ChickenAndy" };

export default function TermsPage() {
  return (
    <PagePlaceholder eyebrow="Legal" title="Terms of Service">
      <p>
        This is a fan-built directory that embeds publicly available Kick streams and chat. It is not
        affiliated with or endorsed by Kick. All streams, chat, emotes and trademarks belong to their
        respective owners and to Kick.
      </p>
      <p>
        By using this site you confirm you are 18 or older and agree to Kick&apos;s own Terms of
        Service, which govern the streams and chat shown here.
      </p>
    </PagePlaceholder>
  );
}
