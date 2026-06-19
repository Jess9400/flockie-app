// Read-only "fingerprint" visualization for a 1-5 vibe-check dimension.
// Used on the profile view page (Fix 3). No bordered container — whitespace only.

export default function FingerprintBar({
  title,
  leftLabel,
  rightLabel,
  value,
  answer,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  value: number; // 1..5
  answer: string;
}) {
  const pct = ((Math.min(5, Math.max(1, value)) - 1) / 4) * 100;

  return (
    <div className="font-nunito">
      <p className="text-[13px] font-bold text-navy">{title}</p>

      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-wide text-navy/55">
        <span className="max-w-[40%] leading-tight">{leftLabel}</span>
        <span className="max-w-[40%] text-right leading-tight">{rightLabel}</span>
      </div>

      <div className="relative mt-1.5 h-2.5 w-full rounded-full bg-[#E5E0D8]">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-flockie-blue to-flockie-coral"
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-flockie-coral shadow-[0_2px_6px_rgba(10,37,69,0.3)]"
          style={{ left: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-[12.5px] font-semibold text-navy/80">{answer}</p>
    </div>
  );
}
