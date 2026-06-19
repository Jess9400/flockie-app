"use client";

// Substantial 1-5 slider (Fix 8): 12px gradient track, 5 snap dots, 32px thumb,
// endpoint mini-labels, live answer below. A transparent native range input sits
// on top for drag + keyboard + accessibility; the visuals are custom.

export default function RangeSlider({
  value,
  onChange,
  scale,
  label,
}: {
  value: number | null;
  onChange: (v: number) => void;
  scale: readonly string[]; // 5 entries
  label?: string;
}) {
  const display = value ?? 3;
  const pct = ((display - 1) / 4) * 100;
  const snaps = [0, 25, 50, 75, 100];

  return (
    <div className="font-nunito">
      {/* endpoint mini labels */}
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-wide text-navy/55">
        <span className="max-w-[42%] leading-tight">{scale[0]}</span>
        <span className="max-w-[42%] text-right leading-tight">{scale[4]}</span>
      </div>

      {/* track + thumb + transparent input */}
      <div className="relative mt-2 h-8">
        {/* track */}
        <div className="absolute left-0 top-1/2 h-3 w-full -translate-y-1/2 rounded-full bg-[#E5E0D8]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-flockie-blue to-flockie-coral"
            style={{ width: value == null ? "0%" : `${pct}%` }}
          />
        </div>
        {/* snap dots */}
        {snaps.map((s) => (
          <span
            key={s}
            className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-navy/30"
            style={{ left: `${s}%` }}
          />
        ))}
        {/* thumb */}
        <span
          className={`pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-navy bg-white shadow-[0_2px_8px_rgba(10,37,69,0.15)] transition-transform ${
            value == null ? "opacity-60" : ""
          }`}
          style={{ left: `${pct}%` }}
        />
        {/* transparent native input for interaction */}
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={display}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      {/* live answer */}
      <p
        className={`mt-2 font-fredoka text-base font-semibold ${
          value == null ? "text-navy/40" : "text-navy"
        }`}
      >
        {value == null ? "Slide to answer" : scale[value - 1]}
      </p>
    </div>
  );
}
