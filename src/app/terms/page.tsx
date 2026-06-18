import type { Metadata } from "next";
import LegalShell, { Section } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Terms & Conditions | Flockie" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="18 June 2026">
      <p className="font-medium">
        By using Flockie you agree to these terms. Please read them.
      </p>
      <Section heading="Who can use Flockie">
        <p>
          You must be 18 or older and provide accurate information. You&rsquo;re
          responsible for activity on your account.
        </p>
      </Section>
      <Section heading="Be a good flockie">
        <p>
          Treat other members with respect. No harassment, discrimination, false
          identities, illegal activity, or unsafe behaviour. We may suspend
          accounts that break these rules.
        </p>
      </Section>
      <Section heading="Trips, Vibes & meetups">
        <p>
          Flockie connects people; it does not organise, supervise, or guarantee
          any trip, Vibe, or meetup. You meet and travel with others at your own
          discretion and risk. Always take sensible safety precautions.
        </p>
      </Section>
      <Section heading="Bookings & deals">
        <p>
          Travel deals are provided by third parties (e.g. Travelpayouts and its
          partners). Their terms apply to any booking; Flockie isn&rsquo;t a
          party to those transactions.
        </p>
      </Section>
      <Section heading="Content">
        <p>
          You own what you post and grant us a licence to display it within the
          app. Don&rsquo;t post anything you don&rsquo;t have the right to share.
        </p>
      </Section>
      <Section heading="Liability">
        <p>
          Flockie is provided &ldquo;as is&rdquo;. To the extent permitted by
          law, we aren&rsquo;t liable for interactions between members or the
          outcome of any trip or activity.
        </p>
      </Section>
      <Section heading="Contact">
        <p>
          Questions? Email{" "}
          <a
            href="mailto:hello@findflockie.com"
            className="font-bold text-flockie-orange underline underline-offset-2"
          >
            hello@findflockie.com
          </a>
          .
        </p>
      </Section>
    </LegalShell>
  );
}
