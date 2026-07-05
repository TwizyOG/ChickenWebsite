import { LegalArticle, LegalSection } from "@/components/LegalArticle";

export const metadata = {
  title: "Terms of Service · ChickenAndy",
  description: "The terms that govern your use of ChickenAndy.",
};

/* Word-for-word copy of chickenandy.vercel.app/terms (extracted 2026-07-04). */

export default function TermsPage() {
  return (
    <LegalArticle
      title="Terms of Service"
      updated="June 17, 2026"
      intro="These Terms of Service (the “Terms”) govern your access to and use of ChickenAndy (the “Service”). By using the Service, you agree to these Terms. If you do not agree, please do not use the Service."
    >
      <LegalSection heading="1. What ChickenAndy is">
        <p>
          ChickenAndy is a community directory that helps people discover live and offline
          streamers across third-party platforms such as Kick, Twitch, YouTube and TikTok. We do
          not host, produce, own or control any streams or streamer content. Live status, viewer
          counts, thumbnails and similar data are sourced from the platforms&rsquo; public APIs and
          belong to those platforms and the respective creators.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <p>
          You must be at least the age of digital consent in your jurisdiction (and old enough to
          use the underlying streaming platforms) to use the Service. By using ChickenAndy you
          confirm that you meet this requirement.
        </p>
      </LegalSection>

      <LegalSection heading="3. Third-party platforms and content">
        <p>
          When you click or watch a streamer through ChickenAndy, you may be taken to, or shown
          content embedded from, a third-party platform. Your use of those platforms is governed by
          their own terms and policies, not ours. We are not responsible for the availability,
          accuracy, legality or content of any third-party stream, and embedded players may be
          unavailable or restricted at the platform&rsquo;s discretion.
        </p>
      </LegalSection>

      <LegalSection heading="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>use the Service for any unlawful purpose or to infringe anyone&rsquo;s rights;</li>
          <li>
            scrape, overload, disrupt or attempt to gain unauthorized access to the Service or its
            infrastructure;
          </li>
          <li>misrepresent your identity or impersonate any person or streamer;</li>
          <li>circumvent any access controls or the admin area.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Intellectual property">
        <p>
          Streamer names, logos, avatars and stream content are the property of the respective
          creators and platforms. The ChickenAndy name, logo and site design are ours. Nothing in
          these Terms grants you a license to any of these marks except as needed to use the
          Service as intended.
        </p>
      </LegalSection>

      <LegalSection heading="6. Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
          warranties of any kind. We do not guarantee that streamer data is accurate, complete or
          up to date, or that the Service will be uninterrupted or error-free.
        </p>
      </LegalSection>

      <LegalSection heading="7. Limitation of liability">
        <p>
          To the fullest extent permitted by law, ChickenAndy and its operators will not be liable
          for any indirect, incidental, special, consequential or punitive damages, or any loss of
          data, arising out of or relating to your use of the Service.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes">
        <p>
          We may update the Service or these Terms from time to time. Material changes will be
          reflected by the &ldquo;Last updated&rdquo; date above. Your continued use after changes
          take effect constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection heading="9. Contact">
        <p>
          Questions about these Terms? Contact us at{" "}
          <a href="mailto:hello@chickenandy.net" className="text-accent hover:underline">
            hello@chickenandy.net
          </a>
          .
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
