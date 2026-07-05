import Link from "next/link";
import { LegalArticle, LegalSection } from "@/components/LegalArticle";

export const metadata = {
  title: "Cookie Policy · ChickenAndy",
  description: "How ChickenAndy uses cookies and similar technologies.",
};

/* Word-for-word copy of chickenandy.vercel.app/cookies (extracted 2026-07-04). */

export default function CookiesPage() {
  return (
    <LegalArticle
      title="Cookie Policy"
      updated="June 17, 2026"
      intro="This Cookie Policy explains how ChickenAndy uses cookies and similar technologies, and how you can control them."
    >
      <LegalSection heading="1. What are cookies?">
        <p>
          Cookies are small text files stored on your device by your browser. Similar technologies
          (like local storage) work the same way. They help websites remember things between visits
          and understand how the site is used.
        </p>
      </LegalSection>

      <LegalSection heading="2. How we use them">
        <p>We keep cookie use to a minimum and group it into two categories:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Essential — required for the site to work, including keeping administrators signed in
            to the admin area. The site cannot function properly without these.
          </li>
          <li>
            Analytics — an anonymous visitor identifier used to measure aggregate traffic and
            growth. These do not identify you personally.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Third-party cookies">
        <p>
          When you watch a stream embedded from a third-party platform (such as Kick), that
          platform&rsquo;s player may set its own cookies and collect data directly from your
          browser under its own policies. We do not control those cookies.
        </p>
      </LegalSection>

      <LegalSection heading="4. Managing cookies">
        <p>
          You can block or delete cookies through your browser settings at any time. Blocking
          essential cookies may stop parts of the admin area from working, but browsing the public
          directory will still function. Most browsers also offer a &ldquo;Do Not Track&rdquo;
          option, which we respect where technically feasible.
        </p>
      </LegalSection>

      <LegalSection heading="5. Changes">
        <p>
          We may update this Cookie Policy as our use of cookies evolves. See also our{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>{" "}
          for how we handle data more broadly.
        </p>
      </LegalSection>

      <LegalSection heading="6. Contact">
        <p>
          Questions about cookies? Email{" "}
          <a href="mailto:hello@chickenandy.net" className="text-accent hover:underline">
            hello@chickenandy.net
          </a>
          .
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
