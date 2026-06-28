import type { Metadata } from "next";
import LegalShell, { Section } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Privacy Policy | Flockie" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="28 June 2026">
      <p className="font-medium">
        Flockie (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps people find compatible
        travel buddies and activity partners. This policy explains what we
        collect and why. We keep it short and plain.
      </p>
      <Section heading="What we collect">
        <p>
          Account details (email), your profile and vibe-check answers, photos
          and any video you upload, activities and preferences, your location
          (including precise coordinates from your device when you grant
          permission, used to show nearby people and Vibes and to measure
          distance), and how you use the app. With your consent we use analytics.
          Other members never see your exact location.
        </p>
      </Section>
      <Section heading="How we use it">
        <p>
          To run matching, show you compatible people and activities, operate the
          app, keep it safe, and contact you about your account. We do not sell
          your personal information.
        </p>
      </Section>
      <Section heading="Who we share it with">
        <p>
          Trusted providers that run Flockie: Supabase (database and auth),
          Vercel (hosting), Google (analytics and email), and Travelpayouts
          (travel deals). Other members see the profile information you choose to
          share.
        </p>
      </Section>
      <Section heading="Your rights">
        <p>
          You can access or delete your data anytime. Email{" "}
          <a
            href="mailto:hello@findflockie.com"
            className="font-bold text-flockie-orange underline underline-offset-2"
          >
            hello@findflockie.com
          </a>{" "}
          and we&rsquo;ll take care of it. When you delete your account, your
          profile and personal data are removed immediately and permanently;
          copies in routine provider backups rotate out shortly after and
          cannot be restored to your account.
        </p>
      </Section>
      <Section heading="Changes">
        <p>We&rsquo;ll update the date above whenever this policy changes.</p>
      </Section>
    </LegalShell>
  );
}
