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
        <p className="font-bold text-ink">⚠️ Beta notice</p>
        <p className="mt-1">
          Flockie is currently in beta. By using Flockie now, you understand you are joining an
          early-stage product, and you accept some additional risks that come with that.
        </p>
      </div>

      <p>
        These terms are an agreement between you and the operators of Flockie
        (&ldquo;we,&rdquo; &ldquo;us&rdquo;). By using Flockie, you agree to them. If you
        don&rsquo;t agree, please don&rsquo;t use the platform. Contact: {email}.
      </p>

      <Section heading="⚠️ The most important thing to read">
        <p>
          <strong>
            Flockie is a matching platform. We connect people. We do not organize trips, supervise
            activities, vet members beyond basic checks, or guarantee any outcome.
          </strong>
        </p>
        <p>
          When you meet, travel with, or do activities with another Flockie member, you do so at
          your own risk. We provide tools to help you make informed choices — vibe checks, reviews,
          optional verifications later — but we cannot predict or prevent how another person
          behaves. No platform can.
        </p>
        <p>
          During beta, this risk is higher than for established platforms. We are still building
          the safety tools that will exist long-term (identity verification, reputation systems,
          automated moderation). For now, your judgment is your most important safety tool.
        </p>
        <p>If you meet someone through Flockie, please:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tell a trusted friend or family member where you&rsquo;re going and who with</li>
          <li>Meet first in a public place</li>
          <li>Trust your instincts — if something feels wrong, leave</li>
          <li>Never share financial information, send money, or hand over identity documents</li>
          <li>For any safety incident, contact local authorities first, then us at {email}</li>
        </ul>
        <p>
          See our{" "}
          <Link href="/safety" className="font-bold text-flockie-orange underline underline-offset-2">
            Safety Guide
          </Link>{" "}
          for detailed practical advice.
        </p>
      </Section>

      <Section heading="You are joining a beta product — what that means">
        <p>By using Flockie at this stage, you specifically acknowledge and accept:</p>
        <ul className="list-decimal space-y-1 pl-5">
          <li>
            <strong>Features may change without notice.</strong> We will add, remove, or modify
            functionality as we learn. We try to give advance notice for big changes but cannot
            always.
          </li>
          <li>
            <strong>Bugs and downtime are possible.</strong> You may experience errors, lost
            messages, broken features, or temporary outages. We will fix them as quickly as we can.
          </li>
          <li>
            <strong>Data loss is possible.</strong> While we use industry-standard backup
            practices, beta products carry higher data risks. Save anything you don&rsquo;t want to
            lose elsewhere.
          </li>
          <li>
            <strong>The platform may shut down.</strong> We may decide to discontinue Flockie at
            any time. If that happens, you will be notified at least 30 days in advance and given
            the option to export your data.
          </li>
          <li>
            <strong>Safety tools are still being built.</strong> Identity verification, automated
            content moderation, and sophisticated reporting workflows may not yet exist or may be
            partial. Adjust your own caution accordingly.
          </li>
          <li>
            <strong>There is no formal customer support team.</strong> We respond to support
            requests directly when possible. Response times may vary.
          </li>
          <li>
            <strong>Pricing and monetization may evolve.</strong> Currently Flockie is free. We
            will give at least 30 days&rsquo; notice before introducing any paid feature, and
            you&rsquo;ll never be charged without explicitly opting in.
          </li>
        </ul>
        <p>
          These are not bugs in the product — they are honest features of the beta stage. We
          disclose them upfront so you can make an informed choice.
        </p>
      </Section>

      <Section heading="Who can use Flockie">
        <ul className="list-disc space-y-1 pl-5">
          <li>You&rsquo;re at least 18 years old</li>
          <li>You provide accurate, truthful information</li>
          <li>You&rsquo;re not legally barred from using the service in your country</li>
          <li>You&rsquo;re not a registered sex offender</li>
        </ul>
        <p>
          If you misrepresent your age or identity, we&rsquo;ll suspend your account and may report
          the activity to authorities.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          You&rsquo;re responsible for everything that happens on your account. Keep your password
          secure. If you suspect unauthorized access, email {email} immediately. Each person may
          have only one Flockie account.
        </p>
      </Section>

      <Section heading="Friend-vouch consent">
        <p>
          If you invite a friend to fill out a vibe check about you, you&rsquo;re responsible for
          confirming they consent to having their answers linked to your profile. When your friend
          opens the vouch link, they see a clear notice that their participation is voluntary and
          their answers will be visible to other members through your matching results.
        </p>
        <p>
          If a friend submits a vibe check about you without your knowledge, we&rsquo;ll remove it
          on request.
        </p>
      </Section>

      <Section heading="What you can post">
        <p>
          You can post photos, video, and text on your profile and in Vibing Chats. You keep
          ownership of what you post; you grant Flockie a worldwide, non-exclusive license to
          display, store, and distribute your content as needed to run the platform.
        </p>
        <p>
          When Flockie incorporates as a company, this license transfers to that company
          automatically. These rights are granted to Flockie as a platform, not to any individual.
        </p>
      </Section>

      <Section heading="What you can't post">
        <p>The following will get content removed and may result in suspension or termination:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Hate speech, discrimination, harassment, or threats</li>
          <li>Sexual content, nudity, or solicitation</li>
          <li>Content involving minors in any context</li>
          <li>Photos of other people without their consent</li>
          <li>Personal data of others (addresses, phone numbers, etc.)</li>
          <li>Drugs, weapons, or illegal goods</li>
          <li>Spam, scams, or fraud</li>
          <li>Impersonation of real people or organizations</li>
          <li>Misleading or false information about yourself</li>
          <li>Anything illegal in your country</li>
        </ul>
      </Section>

      <Section heading="Conduct on the platform">
        <p>These will get your account suspended or banned:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Harassment, stalking, or threats toward members</li>
          <li>Showing up uninvited at someone&rsquo;s location</li>
          <li>
            Discrimination based on race, religion, gender, sexual orientation, disability, or
            other protected characteristics
          </li>
          <li>Using Flockie to recruit for commercial schemes (MLM, paid promotions, etc.)</li>
          <li>Coordinating illegal activity</li>
          <li>Offering or soliciting paid companionship</li>
          <li>Repeatedly canceling on confirmed Vibes (ghosting hosts and groups)</li>
        </ul>
      </Section>

      <Section heading="Activities, trips, and meetings — assumption of risk">
        <p>When you participate in any Vibe, trip, or meeting arranged through Flockie:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Flockie does not organize, supervise, or attend</li>
          <li>
            Activities (surfing, hiking, climbing, drinking, etc.) carry inherent risks of injury
            or illness — sometimes serious
          </li>
          <li>You are responsible for your own skill, fitness, equipment, and judgment</li>
          <li>You&rsquo;re responsible for your own travel insurance, medical insurance, and emergency contacts</li>
          <li>
            Vibe hosts are other members like you — not licensed guides or professional instructors
            (unless verifiably stated otherwise)
          </li>
          <li>Other members may misrepresent themselves despite our checks</li>
          <li>
            During beta, fewer safety guardrails exist than will in the future — your own judgment
            carries more weight than ever
          </li>
        </ul>
        <p>
          You agree not to hold Flockie or any future Flockie entity responsible for injury, loss,
          or harm during any Vibe, trip, or meeting, or for the actions of other members.
        </p>
      </Section>

      <Section heading="Bookings and third-party deals">
        <p>
          Travel deals shown in the Deals tab (Klook, GetYourGuide, Booking.com, etc.) are provided
          by third parties. Their terms, cancellation policies, and refund rules apply — not ours.
          Flockie may earn a commission when you book through an affiliate link; this never affects
          the price you pay.
        </p>
      </Section>

      <Section heading="Suspension and termination">
        <p>
          We may suspend or terminate accounts that violate these terms or behave unsafely.
          We&rsquo;ll give notice unless doing so would compromise an investigation or the safety of
          others.
        </p>
        <p>
          You can delete your account anytime from your profile settings. After deletion, your
          profile is removed immediately and your personal data is permanently deleted right away,
          subject to the retention details in our Privacy Policy.
        </p>
      </Section>

      <Section heading="What happens when Flockie incorporates">
        <ul className="list-disc space-y-1 pl-5">
          <li>You will be notified by email and in-app at least 30 days before the transition</li>
          <li>
            These terms (with any agreed updates) will continue to apply, now between you and the
            new entity
          </li>
          <li>
            Your data, content, and account history transfer to the new entity automatically — no
            action needed on your part
          </li>
          <li>
            You can delete your account at any point, including specifically in response to the
            transition, without penalty
          </li>
          <li>The new entity will inherit all our existing obligations to you</li>
        </ul>
        <p>
          If you do not consent to the transition, delete your account before the transition date
          and your data will be removed per our standard process.
        </p>
      </Section>

      <Section heading="Intellectual property">
        <p>
          The Flockie name, logo, app design, algorithm, and our content belong to us (and, once
          incorporated, to the registered Flockie entity). You may not copy, modify, or distribute
          them without permission.
        </p>
        <p>
          If you believe content on Flockie infringes your copyright, email {email} with the
          details — what work is being infringed, where it appears, your contact info, and a
          statement of good faith. We respond to legitimate notices within 14 days.
        </p>
      </Section>

      <Section heading="Service availability">
        <p>
          We try to keep Flockie running smoothly, but as a beta product we explicitly do not
          guarantee uninterrupted access. We may take the platform down for maintenance, updates,
          fixes, or unexpected issues, and we don&rsquo;t owe compensation for downtime. We may
          also change, add, or remove features at any time.
        </p>
      </Section>

      <Section heading="No warranty">
        <p>
          Flockie is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; with all faults
          inherent to a beta product. We don&rsquo;t guarantee you&rsquo;ll find a match, that any
          match will be a good fit, or that any Vibe or trip will happen as planned. We make no
          warranties beyond what the law requires.
        </p>
      </Section>

      <Section heading="You agree to indemnify us">
        <p>
          If a third party makes a claim against Flockie or any future Flockie entity because of
          your use of the platform, your content, your conduct, or your participation in a Vibe or
          trip, you agree to cover any costs and damages.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update these terms as the platform evolves. For material changes, we&rsquo;ll
          notify you in-app and by email at least 30 days before they take effect. Continuing to use
          Flockie after the effective date means you accept the new terms. If you don&rsquo;t, you
          can delete your account.
        </p>
      </Section>

      <Section heading="If something doesn't hold up">
        <p>
          If any part of these terms is found unenforceable in your jurisdiction, the rest still
          applies. These terms (along with our Privacy Policy) are the full agreement between you
          and Flockie.
        </p>
      </Section>

      <Section heading="Contact">
        <p>For any question, notice, or concern: {email}.</p>
      </Section>
    </LegalShell>
  );
}
