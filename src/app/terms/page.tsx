import type { Metadata } from "next";
import Link from "next/link";
import LegalShell, { Section } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Terms & Conditions | Flockie" };

const email = (
  <a
    href="mailto:hello@findflockie.com"
    className="font-bold text-flockie-orange underline underline-offset-2"
  >
    hello@findflockie.com
  </a>
);

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="28 June 2026">
      <div className="rounded-2xl border-2 border-flockie-orange/30 bg-flockie-orange/10 p-4 text-sm">
        <p>
          Flockie is in beta. By using it now, you understand you are joining an early-stage product
          being tested by a small team.
        </p>
      </div>

      <p>
        These terms are an agreement between you and the Flockie team (the operators of this beta
        product). By using Flockie, you agree to them. If you don&rsquo;t agree, please don&rsquo;t
        use the platform. Contact: {email}.
      </p>

      <Section heading="⚠️ Read this carefully">
        <p>
          <strong>
            Flockie is a matching platform. We connect people. We do not organize trips, supervise
            activities, vet members, or guarantee any outcome.
          </strong>
        </p>
        <p>
          When you meet, travel with, or do activities with another Flockie member, you do so at
          your own risk. We provide vibe-matching tools to help you make informed choices, but we
          cannot predict how another person will behave.
        </p>
        <p>
          During beta, even fewer safety guardrails exist than will in the future. Your judgment is
          your most important safety tool.
        </p>
        <p>If you meet someone through Flockie:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tell a trusted person where you&rsquo;re going</li>
          <li>Meet first in a public place</li>
          <li>Trust your instincts — leave if something feels wrong</li>
          <li>Never send money or share identity documents</li>
          <li>For any safety incident, contact local authorities first, then us at {email}</li>
        </ul>
        <p>
          See our{" "}
          <Link href="/safety" className="font-bold text-flockie-orange underline underline-offset-2">
            Safety Guide
          </Link>{" "}
          for more.
        </p>
      </Section>

      <Section heading="You are joining a beta product">
        <p>By using Flockie now, you accept:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Features may change without notice. We&rsquo;re still figuring out what works.</li>
          <li>Bugs and downtime are possible. Beta software is not stable.</li>
          <li>Data loss is possible. Save anything you don&rsquo;t want to lose elsewhere.</li>
          <li>
            The platform may shut down. We&rsquo;ll give 30 days&rsquo; notice and an option to
            export your data.
          </li>
          <li>
            Safety tools are still being built. Identity verification, automated moderation, and
            other features may not yet exist.
          </li>
          <li>No formal customer support team. The team responds when possible.</li>
          <li>
            Pricing may evolve. Currently Flockie is free. We&rsquo;ll give 30 days&rsquo; notice
            before introducing any paid feature, and you will never be charged without opt-in.
          </li>
        </ul>
      </Section>

      <Section heading="Who can use Flockie">
        <ul className="list-disc space-y-1 pl-5">
          <li>You must be at least 18</li>
          <li>You must provide accurate information</li>
          <li>You must not be legally barred from using the service in your country</li>
          <li>You must not be a registered sex offender</li>
        </ul>
      </Section>

      <Section heading="Your account">
        <p>
          You&rsquo;re responsible for everything that happens on your account. Each person may have
          only one account.
        </p>
      </Section>

      <Section heading="Verification (future feature)">
        <p>
          Currently, Flockie does not run identity verification or background checks. When
          verification launches, it will confirm identity only — not safety. We do not screen
          members against criminal databases.
        </p>
      </Section>

      <Section heading="Friend-vouch consent">
        <p>
          If a friend fills out a vibe check about you, you&rsquo;re responsible for confirming they
          consent. Your friend sees a consent notice when they open the vouch link.
        </p>
      </Section>

      <Section heading="What you can post">
        <p>
          You own what you post. You grant Flockie a worldwide, non-exclusive license to display
          your content within the platform. When Flockie incorporates, this license transfers to the
          new entity automatically.
        </p>
      </Section>

      <Section heading="What you can't post">
        <p>
          Hate speech, discrimination, harassment, threats, sexual content, content involving
          minors, photos of others without consent, personal data of others, drugs, weapons,
          illegal goods, spam, scams, impersonation, misleading information, anything illegal.
        </p>
        <p>Violations result in content removal and possible suspension or termination.</p>
      </Section>

      <Section heading="Conduct">
        <p>These will get your account suspended or banned:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Harassment, stalking, or threats</li>
          <li>Showing up uninvited at someone&rsquo;s location</li>
          <li>Discrimination</li>
          <li>Recruiting for commercial schemes</li>
          <li>Coordinating illegal activity</li>
          <li>Offering or soliciting paid companionship</li>
          <li>Repeatedly ghosting Vibes you confirmed</li>
        </ul>
      </Section>

      <Section heading="Activities, trips, and meetings — your responsibility">
        <p>When you participate in any Vibe, trip, or meeting:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Flockie does not organize, supervise, or attend</li>
          <li>Activities carry inherent risks (sometimes serious)</li>
          <li>You are responsible for your skill, fitness, insurance, and judgment</li>
          <li>Vibe hosts are members, not professional guides</li>
          <li>Other members may misrepresent themselves</li>
          <li>During beta, expect fewer safety guardrails</li>
        </ul>
        <p>
          You agree not to hold Flockie, its team, or any future Flockie entity responsible for any
          injury, loss, or harm related to platform use.
        </p>
      </Section>

      <Section heading="Third-party deals">
        <p>
          Travel deals in the Deals tab are provided by third parties. Their terms apply, not ours.
          Flockie may earn affiliate commission; this never affects your price.
        </p>
      </Section>

      <Section heading="Suspension and termination">
        <p>
          We may suspend or terminate accounts that violate these terms. You can delete your account
          anytime.
        </p>
      </Section>

      <Section heading="Intellectual property">
        <p>
          Flockie&rsquo;s name, logo, design, and algorithm belong to the Flockie team (and will
          transfer to the registered entity when it forms). Don&rsquo;t copy or distribute without
          permission.
        </p>
      </Section>

      <Section heading="Service availability">
        <p>
          As a beta product, we don&rsquo;t guarantee uninterrupted access. We may take the platform
          down anytime for any reason.
        </p>
      </Section>

      <Section heading="No warranty">
        <p>
          Flockie is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; with all
          beta-related faults. No guarantees of matches, quality of matches, or trip outcomes.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p>
          To the maximum extent allowed by law, our total liability to you for any platform-related
          claim is limited to USD 100, or any amount you&rsquo;ve paid Flockie in the past 12
          months, whichever is greater. Currently, Flockie is free, so this limit is USD 100.
        </p>
        <p>We are not liable for:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Indirect, incidental, or consequential damages</li>
          <li>Actions of other members</li>
          <li>Third-party services</li>
          <li>Damages from any Vibe, trip, or activity</li>
          <li>Beta-specific issues (bugs, downtime, data loss)</li>
        </ul>
        <p>Nothing in this section limits liability that can&rsquo;t be excluded by law.</p>
      </Section>

      <Section heading="Team liability during beta">
        <p>
          The current operators of Flockie act in their capacity as the Flockie team, not in their
          personal capacities. To the maximum extent allowed by law, individual team members are not
          personally liable for claims related to platform use during beta.
        </p>
      </Section>

      <Section heading="You agree to indemnify us">
        <p>If your use of Flockie causes a claim against us, you cover the costs.</p>
      </Section>

      <Section heading="Governing law">
        <p>
          These terms are governed by the laws of your country of residence, except where law
          requires otherwise. Disputes will first be discussed in good faith via {email}. Most
          issues can be resolved this way.
        </p>
        <p className="text-sm italic">
          When Flockie incorporates, a specific jurisdiction will be selected and these terms
          updated. Existing users will be notified at least 30 days before any change.
        </p>
      </Section>

      <Section heading="What happens when Flockie incorporates">
        <p>When the Flockie team becomes a registered company:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>You will be notified by email at least 30 days in advance</li>
          <li>These terms will continue to apply, now between you and the new entity</li>
          <li>Your data and account transfer automatically</li>
          <li>You can delete your account at any point</li>
        </ul>
        <p>
          If you don&rsquo;t agree with the new entity, delete your account before transition and
          your data is removed.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update these terms. Material changes are announced by email at least 30 days in
          advance.
        </p>
      </Section>

      <Section heading="If something doesn't hold up">
        <p>If any part of these terms is found unenforceable, the rest still applies.</p>
      </Section>

      <Section heading="Contact">
        <p>{email}</p>
      </Section>
    </LegalShell>
  );
}
