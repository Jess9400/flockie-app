import type { Metadata } from "next";
import LegalShell, { Section } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Privacy Policy | Flockie" };

const email = (
  <a
    href="mailto:hello@findflockie.com"
    className="font-bold text-flockie-orange underline underline-offset-2"
  >
    hello@findflockie.com
  </a>
);

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="28 June 2026">
      <div className="rounded-2xl border-2 border-flockie-orange/30 bg-flockie-orange/10 p-4 text-sm">
        <p className="font-bold text-ink">⚠️ Beta notice</p>
        <p className="mt-1">
          Flockie is currently in beta testing. We are not yet a registered company. The
          founders operate this beta directly. This is normal for early-stage products, but you
          should know it before sharing your data with us.
        </p>
      </div>

      <Section heading="Who we are">
        <p>
          Flockie is currently operated as a <strong>beta test by its founders</strong>, Jessica
          Nascimento and her co-founder. We have not yet registered a legal entity. Once we do —
          likely within the next 6 months — we will become a registered company and notify all
          users in writing before transferring any data to the new entity.
        </p>
        <p>
          In the meantime, Jessica Nascimento acts as the data controller for personal
          information collected through Flockie.
        </p>
        <p>For all privacy questions, requests, or concerns: {email}</p>
      </Section>

      <Section heading="What this beta status means for you">
        <ul className="list-decimal space-y-1 pl-5">
          <li>
            <strong>The platform may change rapidly.</strong> Features may launch, change, or be
            removed without notice as we learn what works.
          </li>
          <li>
            <strong>Service interruptions may happen.</strong> We do our best, but beta software is
            not enterprise-grade. You may experience downtime, bugs, or data loss.
          </li>
          <li>
            <strong>Your data is portable.</strong> You can request all your data via email and
            delete your account at any time. We will not sell, transfer, or otherwise hand over
            user data to a third party without your explicit consent.
          </li>
        </ul>
      </Section>

      <Section heading="What we collect">
        <p className="font-bold text-ink">Information you give us:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Email address, name, age, city, profile photos, optional intro video</li>
          <li>Your vibe check answers (travel style, social energy, lifestyle)</li>
          <li>Activity interests, skill levels, and hard preferences</li>
          <li>Optional social media handles</li>
          <li>Messages you send in Vibing Chats</li>
          <li>Reviews you give after Vibes and trips</li>
        </ul>
        <p>
          If a friend fills out a vibe check about you, we collect their answers and link them to
          your profile. Your friend is told this when they submit, and can ask us to remove their
          response at any time.
        </p>
        <p className="font-bold text-ink">Information collected automatically:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>App usage data (taps, screens viewed, features used)</li>
          <li>Device type, browser, IP address</li>
          <li>
            Your location — including precise coordinates from your device when you grant
            permission — used to surface nearby people and Vibes and to measure distance. Other
            members never see your exact location, only your city.
          </li>
        </ul>
      </Section>

      <Section heading="How we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To match you with compatible people and Vibes</li>
          <li>To run the app: authentication, notifications, chat</li>
          <li>To improve our matching algorithm</li>
          <li>To keep the platform safe (detect fake accounts, harassment, fraud)</li>
          <li>To contact you about your account or important updates</li>
        </ul>
        <p>
          During beta we also use aggregated, anonymized data to understand what&rsquo;s working.
          Aggregated data cannot be linked back to you.
        </p>
        <p>
          <strong>
            We never sell your personal information. We never use your messages to train external
            AI models. We don&rsquo;t run ads.
          </strong>
        </p>
      </Section>

      <Section heading="Lawful basis (for EU/UK users)">
        <p>We process your data based on:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Contract:</strong> to provide the service you signed up for
          </li>
          <li>
            <strong>Legitimate interest:</strong> to improve the product and keep it safe
          </li>
          <li>
            <strong>Consent:</strong> for optional features like analytics or marketing emails
          </li>
          <li>
            <strong>Legal obligation:</strong> when the law requires it
          </li>
        </ul>
        <p>You can withdraw consent for any consent-based processing at any time.</p>
      </Section>

      <Section heading="Who we share with">
        <p>Only the providers we need to run Flockie:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Supabase</strong> — database, authentication, real-time chat
          </li>
          <li>
            <strong>Vercel</strong> — hosting
          </li>
          <li>
            <strong>Google</strong> — email delivery and analytics
          </li>
          <li>
            <strong>Travelpayouts and its partners</strong> (Klook, GetYourGuide, Booking.com) —
            only when you click an affiliate link
          </li>
        </ul>
        <p>We may also disclose data when legally required (law enforcement, court orders).</p>
        <p>
          <strong>Other Flockie members</strong> see what&rsquo;s on your profile: photos, vibe
          check answers, one-liner, city. They never see your email, exact location, or your
          private messages with other members.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Active account data:</strong> kept while your account is active.
          </li>
          <li>
            <strong>Deleted account data:</strong> when you delete your account, your profile and
            personal data are removed immediately and permanently. Any copies in routine system
            backups are rotated out shortly afterward and cannot be restored to your account.
          </li>
        </ul>
      </Section>

      <Section heading="Your rights">
        <p>Email {email} to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access a copy of your data</li>
          <li>Correct inaccurate data</li>
          <li>Delete your account and data</li>
          <li>Receive your data in a portable format</li>
          <li>Object to certain processing</li>
          <li>Withdraw consent</li>
        </ul>
        <p>We respond within 30 days. We never charge for these requests.</p>
        <p>
          If you&rsquo;re in the EU, UK, or Brazil, you can also complain to your local data
          protection authority (ICO in the UK, your national DPA in the EU, ANPD in Brazil).
        </p>
      </Section>

      <Section heading="Security">
        <p>
          We use industry-standard security (encryption in transit and at rest, access controls).
          No system is fully secure, and as a beta platform our security posture will mature over
          time. If a breach affects your data, we&rsquo;ll notify you and the relevant authorities
          within 72 hours.
        </p>
      </Section>

      <Section heading="What happens when we incorporate">
        <ul className="list-disc space-y-1 pl-5">
          <li>You will be notified by email and in-app at least 30 days before the transfer</li>
          <li>
            The new entity will operate under terms substantially the same as these — any material
            change requires fresh consent from you
          </li>
          <li>
            You can delete your account at any point, including in response to incorporation,
            without penalty
          </li>
          <li>The new entity will inherit our existing data protection commitments</li>
        </ul>
        <p>
          If you do not agree with the change to a new entity, you can delete your account before
          the transfer and your data will be removed per our standard process.
        </p>
      </Section>

      <Section heading="International transfers">
        <p>
          Your data may be processed in countries other than where you live, including the United
          States and the European Union. For EU/UK data transferred abroad, we rely on Standard
          Contractual Clauses.
        </p>
      </Section>

      <Section heading="Children's privacy">
        <p>
          Flockie is for users 18+. We do not knowingly collect data from minors. If you believe a
          minor is using Flockie, email {email} and we&rsquo;ll investigate within 48 hours.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          We use essential cookies to keep you logged in. With your consent, we use analytics
          cookies to understand app usage. You can change preferences in your account settings
          anytime.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update this policy as the product evolves. For material changes, we&rsquo;ll
          notify you in-app and by email at least 30 days before they take effect. The
          &ldquo;Last updated&rdquo; date at the top will always reflect the most recent version.
        </p>
      </Section>
    </LegalShell>
  );
}
