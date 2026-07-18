import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import InviteFriendsButton from "@/components/InviteFriendsButton";

// Shown when the viewer's LOCAL pool is empty (no activity buddies AND no Vibes
// in their city). Frames the emptiness as opportunity — not an apology — and
// leads with an invite CTA, so the page never opens on "everyone is in <some
// other city>". Global browsing still lives below, clearly labelled as global.
export default function EarlyCityState({
  city,
  inviterId,
  inviterName,
}: {
  city: string;
  inviterId: string;
  inviterName?: string;
}) {
  const t = useTranslations("components");
  return (
    <section className="mx-4 mt-6 rounded-3xl border-2 border-ink/15 bg-cream p-6 text-center shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-8">
      <div className="text-4xl" aria-hidden>
        🌱
      </div>
      <h2 className="mt-2 text-[24px] font-black leading-tight sm:text-[30px]">
        {t("earlyCity.heading", { city })}
      </h2>
      <p className="mx-auto mt-2 max-w-md font-bold text-ink/70">
        {t("earlyCity.body")}
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <InviteFriendsButton
          inviterId={inviterId}
          inviterName={inviterName}
          city={city}
          label={t("earlyCity.invite")}
        />
        <Link
          href="#explore-world"
          className="inline-flex items-center gap-1 text-sm font-bold text-flockie-coral"
        >
          {t("earlyCity.exploreWorld")} <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
