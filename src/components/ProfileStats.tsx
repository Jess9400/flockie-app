import { useTranslations } from "next-intl";

// "On Flockie" social-proof stat grid (shared by the Profile tab and public profiles).
export default function ProfileStats({ stats }: { stats: Record<string, number> }) {
  const t = useTranslations("components");
  const items = [
    { key: "vibesHosted", label: "Vibes hosted", value: stats.vibes_hosted },
    { key: "vibesJoined", label: "Vibes joined", value: stats.vibes_attended },
    { key: "activities", label: "Activities", value: stats.activities_created },
    { key: "trips", label: "Trips", value: stats.trips_created },
    { key: "flocksHosted", label: "Flocks hosted", value: stats.flocks_created },
    { key: "flocksJoined", label: "Flocks joined", value: stats.flocks_joined },
    { key: "travelBuddies", label: "Travel buddies", value: stats.buddies_matched },
  ].filter((s) => (s.value ?? 0) > 0);

  if (!items.length) return null;

  return (
    <div className="mt-5">
      <p className="text-sm font-extrabold text-navy">{t("profileStats.onFlockie")}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((s) => (
          <div key={s.key} className="rounded-2xl border-2 border-ink bg-white py-2.5 text-center">
            <p className="text-xl font-black text-navy">{s.value}</p>
            <p className="text-[10px] font-bold leading-tight text-muted">{t(`profileStats.${s.key}` as `profileStats.${string}`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
