import type { Metadata } from "next";
import LegalShell, { Section } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Safety Guide | Flockie" };

const email = (
  <a
    href="mailto:hello@findflockie.com"
    className="font-bold text-flockie-orange underline underline-offset-2"
  >
    hello@findflockie.com
  </a>
);

export default function SafetyPage() {
  return (
    <LegalShell title="Safety Guide" updated="28 June 2026">
      <div className="rounded-2xl border-2 border-flockie-orange/30 bg-flockie-orange/10 p-4 text-sm">
        <p className="font-bold text-ink">Your judgment is your most important safety tool.</p>
        <p className="mt-1">
          Flockie connects people — we don&rsquo;t organize, supervise, or vet members beyond basic
          checks, and during beta fewer safety guardrails exist than will in the future. The advice
          below is practical, not legal advice. If you&rsquo;re ever in immediate danger, contact
          local emergency services first.
        </p>
      </div>

      <Section heading="Before you meet">
        <ul className="list-disc space-y-1 pl-5">
          <li>Tell a trusted friend or family member where you&rsquo;re going and who with.</li>
          <li>Share your live location with someone you trust for the first meeting.</li>
          <li>
            Have a short video or voice chat first if you can — it&rsquo;s a good way to confirm
            someone is who they say they are.
          </li>
          <li>
            Read their profile and vibe check. Mismatched details or pressure to move off Flockie
            quickly are red flags.
          </li>
          <li>Keep your own phone charged and bring a way to get home independently.</li>
        </ul>
      </Section>

      <Section heading="When you meet">
        <ul className="list-disc space-y-1 pl-5">
          <li>Meet first in a public, populated place — a café, a busy trailhead, a group setting.</li>
          <li>Stay in control of your own transport, drinks, and belongings.</li>
          <li>Don&rsquo;t share your home address or exact location until you trust someone.</li>
          <li>
            Trust your instincts. If something feels wrong, you don&rsquo;t owe anyone an
            explanation — leave.
          </li>
          <li>Check in with your trusted contact during and after the meeting.</li>
        </ul>
      </Section>

      <Section heading="Money and scams">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Never send money, share financial information, or hand over identity
            documents</strong> to anyone you meet on Flockie.
          </li>
          <li>Be wary of sob stories, investment tips, crypto offers, or urgent requests for help.</li>
          <li>
            Book travel and activities through official providers. Deals in the Deals tab are run by
            third parties under their own terms — review them before paying.
          </li>
          <li>If someone pressures you about money, stop talking to them and report them.</li>
        </ul>
      </Section>

      <Section heading="Trips and activities">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Vibe hosts are other members, not licensed guides or instructors. Activities like
            surfing, hiking, climbing, or drinking carry real risk.
          </li>
          <li>Know your own skill, fitness, and limits — and the conditions and equipment needed.</li>
          <li>Arrange your own travel and medical insurance and keep emergency contacts handy.</li>
          <li>For longer trips, agree on plans, costs, and expectations in writing beforehand.</li>
          <li>You can leave any trip or activity at any time if you feel unsafe.</li>
        </ul>
      </Section>

      <Section heading="Protecting your privacy">
        <ul className="list-disc space-y-1 pl-5">
          <li>Other members see your profile and city, never your email or exact location.</li>
          <li>Share contact details only with people you trust, and only when you&rsquo;re ready.</li>
          <li>Be thoughtful about photos and details that could identify where you live or work.</li>
        </ul>
      </Section>

      <Section heading="Reporting and emergencies">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>If you are in immediate danger, contact local emergency services first.</strong>
          </li>
          <li>
            Report unsafe behavior, harassment, scams, or fake accounts to us at {email}. Include
            names, screenshots, and any details you can — it helps us act faster.
          </li>
          <li>
            You can also report or block a member from their profile. We may suspend or remove
            accounts that break our{" "}
            <a href="/terms" className="font-bold text-flockie-orange underline underline-offset-2">
              Terms
            </a>
            .
          </li>
          <li>
            If a crime may have occurred, report it to local authorities, then tell us so we can
            support the investigation.
          </li>
        </ul>
      </Section>

      <Section heading="Questions">
        <p>Anything safety-related, reach us anytime at {email}.</p>
      </Section>
    </LegalShell>
  );
}
