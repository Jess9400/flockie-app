// "On Flockie" social-proof stat grid (shared by the Profile tab and public profiles).
export default function ProfileStats({ stats }: { stats: Record<string, number> }) {
  const items = [
    { label: "Vibes hosted", value: stats.vibes_hosted },
    { label: "Vibes joined", value: stats.vibes_attended },
    { label: "Activities", value: stats.activities_created },
    { label: "Trips", value: stats.trips_created },
    { label: "Flocks hosted", value: stats.flocks_created },
    { label: "Flocks joined", value: stats.flocks_joined },
    { label: "Travel buddies", value: stats.buddies_matched },
  ].filter((s) => (s.value ?? 0) > 0);

  if (!items.length) return null;

  return (
    <div className="mt-5">
      <p className="text-sm font-extrabold text-navy">On Flockie</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="rounded-2xl border-2 border-ink bg-white py-2.5 text-center">
            <p className="text-xl font-black text-navy">{s.value}</p>
            <p className="text-[10px] font-bold leading-tight text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
