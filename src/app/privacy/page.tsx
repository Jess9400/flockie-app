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
    <LegalShell title="Privacy Policy" updated="29 June 2026">
      <div className="rounded-2xl border-2 border-flockie-orange/30 bg-flockie-orange/10 p-4 text-sm">
        <p>
          Flockie is in beta. This means the platform is still being built and tested with a small
          group of early users. By using Flockie at this stage, you understand that things are
          evolving.
        </p>
      </div>

      <Section heading="Who we are">
        <p>
          Flockie is operated by the Flockie team as a beta product. We are an early-stage team
          currently testing our platform with a small group of users. We will become a registered
          company in the coming months and will notify all users by email before that change takes
          effect.
        </p>
        <p>
          For all privacy questions, requests, or to contact the team directly: {email}
        </p>
      </Section>

      <Section heading="What we collect">
        <p className="font-bold text-ink">Information you give us:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Email address, name, age, city, profile photos, optional intro video</li>
          <li>Your vibe check answers (travel and activity preferences)</li>
          <li>Activity interests, skill levels, hard preferences</li>
          <li>Optional social media handles</li>
          <li>Messages you send through the platform</li>
          <li>Reviews you give after Vibes and trips</li>
        </ul>
        <p>
          If a friend fills out a vibe check about you, we collect their answers and link them to
          your profile, with their consent.
        </p>
        <p className="font-bold text-ink">Information collected automatically:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>App usage data, device type, browser, IP address</li>
          <li>
            Your location, including precise coordinates from your device when you grant
            permission, used to surface nearby people and Vibes. Other members never see your exact
            location.
          </li>
        </ul>
      </Section>

      <Section heading="How we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To match you with compatible people and Vibes</li>
          <li>To run the app: authentication, notifications, chat</li>
          <li>To improve our matching algorithm</li>
          <li>To keep the platform safe</li>
          <li>
            To email you about your account and your Flockie activity — invitations, matches,
            confirmations, and reminders
          </li>
        </ul>
        <p>
          We send these emails (and in-app notifications) about activity on your account. You can
          opt out of non-essential emails anytime via the unsubscribe link at the bottom of any
          email, or in your settings — we&rsquo;ll still send essential account and safety messages.
        </p>
        <p>
          <strong>
            We never sell your personal information. We never use your messages to train external
            AI models. We don&rsquo;t run ads.
          </strong>
        </p>
      </Section>

      <Section heading="Who we share it with">
        <p>
          Only the infrastructure providers we need to run Flockie (database, hosting, email
          delivery). Your data may be processed in multiple countries as a result. We do not share
          data with anyone else except when legally required.
        </p>
        <p>
          Other Flockie members see what&rsquo;s on your profile. They do not see your email, exact
          location, or private messages.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          While your account is active. When you delete your account, your data is removed
          immediately and permanently; any copies in routine system backups are rotated out shortly
          afterward and cannot be restored.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>You can email {email} at any time to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access your data</li>
          <li>Correct your data</li>
          <li>Delete your account and data</li>
          <li>Receive your data in a portable format</li>
          <li>Object to certain processing</li>
        </ul>
        <p>We respond within 30 days. We never charge for these requests.</p>
        <p>
          If you are in the EU, UK, or Brazil, you also have rights under your local data
          protection law and can complain to your local data protection authority.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          We use industry-standard security (encryption, access controls). No system is fully
          secure, especially in beta. If a breach affects you, we&rsquo;ll notify you within 72
          hours.
        </p>
      </Section>

      <Section heading="Children's privacy">
        <p>Flockie is for users 18+. We do not knowingly collect data from minors.</p>
      </Section>

      <Section heading="What happens when we incorporate">
        <p>When the Flockie team becomes a registered company:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>You will be notified by email at least 30 days before</li>
          <li>Your data and account transfer to the new entity automatically</li>
          <li>These terms continue to apply</li>
          <li>You can delete your account at any time, including in response to this change</li>
        </ul>
      </Section>

      <Section heading="Changes">
        <p>
          We may update this policy. Material changes are announced by email at least 30 days in
          advance.
        </p>
      </Section>

      <Section heading="Contact">
        <p>{email}</p>
      </Section>
    </LegalShell>
  );
}
