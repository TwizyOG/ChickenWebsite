import PagePlaceholder from "@/components/PagePlaceholder";

export const metadata = { title: "Cookie Policy — ChickenAndy" };

export default function CookiesPage() {
  return (
    <PagePlaceholder eyebrow="Legal" title="Cookie Policy">
      <p>
        This site sets no tracking cookies of its own. It uses browser localStorage/sessionStorage
        only to remember your age confirmation, your favourites, and a short-lived cache of live
        stream data.
      </p>
      <p>
        Embedded Kick players and chat may set their own cookies under kick.com — those are covered by
        Kick&apos;s cookie policy.
      </p>
    </PagePlaceholder>
  );
}
