import Link from "next/link";
import { LegalArticle, LegalSection } from "@/components/LegalArticle";

export const metadata = {
  title: "Privacy Policy · ChickenAndy",
  description: "How ChickenAndy handles your data.",
};

/* Word-for-word copy of chickenandy.vercel.app/privacy (extracted 2026-07-04). */

export default function PrivacyPage() {
  return (
    <LegalArticle
      title="Privacy Policy"
      updated="June 17, 2026"
      intro="This Privacy Policy explains what information ChickenAndy collects, how we use it, and the choices you have. We aim to collect as little as possible."
    >
      <LegalSection heading="1. Information we collect">
        <p>
          ChickenAndy is a public directory and does not require visitors to create an account. We
          collect:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Anonymous usage data — page views and an anonymous visitor identifier stored on your
            device, used only to measure aggregate traffic and growth. This is not linked to a
            real-world identity.
          </li>
          <li>
            Administrator accounts — if you are an operator, we store the email and authentication
            details needed to access the admin area (handled by our authentication provider).
          </li>
          <li>
            Technical data — standard server logs (such as IP address and browser type) that most
            websites receive automatically, used for security and reliability.
          </li>
        </ul>
        <p>
          We do not collect streamer-level personal analytics, and we do not sell your data.
        </p>
      </LegalSection>

      <LegalSection heading="2. How we use information">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>to operate, maintain and improve the Service;</li>
          <li>to understand aggregate traffic, engagement and growth;</li>
          <li>to secure the Service and prevent abuse;</li>
          <li>to authenticate administrators.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Cookies and tracking">
        <p>
          We use a small number of cookies and similar technologies for essential functionality and
          anonymous analytics. For details and how to control them, see our{" "}
          <Link href="/cookies" className="text-accent hover:underline">
            Cookie Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="4. Third-party services">
        <p>We rely on a few trusted third parties to run the Service:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Hosting, database, authentication and storage providers that process data on our behalf
            to keep the site running.
          </li>
          <li>
            Streaming platform public APIs (e.g. Kick) from which we read public channel data. When
            you watch an embedded stream, that platform may set its own cookies and receive data
            directly from your browser under its own privacy policy.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Data retention">
        <p>
          We keep anonymous analytics only as long as needed to understand trends, and
          administrator data for as long as the account is active. Server logs are rotated
          regularly.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your choices and rights">
        <p>
          You can clear or block cookies in your browser at any time. Depending on your location,
          you may have rights to access or delete personal data we hold about you — contact us and
          we&rsquo;ll help.
        </p>
      </LegalSection>

      <LegalSection heading="7. Children’s privacy">
        <p>
          ChickenAndy is not directed at children under the age of digital consent in their
          jurisdiction, and we do not knowingly collect their personal information.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes">
        <p>
          We may update this Policy from time to time; the &ldquo;Last updated&rdquo; date above
          reflects the latest revision.
        </p>
      </LegalSection>

      <LegalSection heading="9. Contact">
        <p>
          For privacy questions or requests, email{" "}
          <a href="mailto:hello@chickenandy.net" className="text-accent hover:underline">
            hello@chickenandy.net
          </a>
          .
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
