// Weighted % summary of a Vibe's attendee reviews.
export default function VibeReviewSummary({
  recommendPct,
  count,
  tagPcts,
}: {
  recommendPct: number;
  count: number;
  tagPcts: { tag: string; pct: number }[];
}) {
  if (count === 0) return null;
  return (
    <section className="mt-6 rounded-3xl border-2 border-navy bg-[#FCF9F4] p-5 font-nunito">
      <div className="flex items-baseline gap-2">
        <span className="font-fredoka text-3xl font-bold text-flockie-coral">{recommendPct}%</span>
        <span className="font-nunito text-sm font-semibold text-navy">
          would recommend
        </span>
        <span className="ml-auto font-nunito text-xs font-medium text-navy/50">
          {count} review{count > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {tagPcts.map(({ tag, pct }) => (
          <div key={tag}>
            <div className="flex items-center justify-between font-nunito text-xs font-semibold text-navy">
              <span>{tag}</span>
              <span className="text-navy/60">{pct}%</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-navy/10">
              <div
                className="h-full rounded-full bg-flockie-blue"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
