"use client";

import {
  SLIDERS,
  TRIP_VIBES,
  TRAVEL_STYLES,
  DEALBREAKERS,
  MAX_TAGS,
  ONE_LINER_MAX,
  type VibeAnswers,
} from "@/lib/vibe-check";

type Props = {
  answers: VibeAnswers;
  onChange: (patch: Partial<VibeAnswers>) => void;
  oneLinerPrompt: string;
};

export default function VibeQuestions({ answers, onChange, oneLinerPrompt }: Props) {
  function toggleTag(key: "trip_vibe" | "travel_style", value: string) {
    const list = answers[key];
    if (list.includes(value)) {
      onChange({ [key]: list.filter((v) => v !== value) } as Partial<VibeAnswers>);
    } else if (list.length < MAX_TAGS) {
      onChange({ [key]: [...list, value] } as Partial<VibeAnswers>);
    }
  }

  function toggleDealbreaker(value: string) {
    const list = answers.dealbreakers;
    onChange({
      dealbreakers: list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    });
  }

  return (
    <div className="space-y-7">
      {/* 6 sliders */}
      {SLIDERS.map((s, i) => {
        const val = answers[s.key];
        const display = val ?? 3;
        return (
          <div key={s.key}>
            <p className="text-sm font-extrabold">
              {i + 1}. {s.label}
            </p>
            <p className="text-xs font-medium text-muted">{s.prompt}</p>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={display}
              onChange={(e) =>
                onChange({ [s.key]: Number(e.target.value) } as Partial<VibeAnswers>)
              }
              className="mt-3 w-full accent-flockie-orange"
            />
            <p
              className={`mt-1 text-sm font-bold ${
                val == null ? "text-muted" : "text-flockie-orange"
              }`}
            >
              {val == null ? "Slide to answer" : s.scale[val - 1]}
            </p>
          </div>
        );
      })}

      {/* Trip vibe — max 3 */}
      <TagGroup
        n={7}
        title="Trip vibe"
        hint={`What kind of trip are you usually after? Pick up to ${MAX_TAGS}.`}
        options={TRIP_VIBES}
        selected={answers.trip_vibe}
        onToggle={(v) => toggleTag("trip_vibe", v)}
      />

      {/* Travel style — max 3 */}
      <TagGroup
        n={8}
        title="Travel style"
        hint={`Which sound most like you? Pick up to ${MAX_TAGS}.`}
        options={TRAVEL_STYLES}
        selected={answers.travel_style}
        onToggle={(v) => toggleTag("travel_style", v)}
      />

      {/* Dealbreakers */}
      <div>
        <p className="text-sm font-extrabold">9. Hard preferences</p>
        <p className="text-xs font-medium text-muted">
          Tick what applies. These are used as hard filters.
        </p>
        <div className="mt-2 space-y-2">
          {DEALBREAKERS.map((d) => {
            const on = answers.dealbreakers.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDealbreaker(d)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 border-ink px-3 py-2.5 text-left text-sm font-bold ${
                  on ? "bg-ink text-white" : "bg-white"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-ink text-xs ${
                    on ? "bg-white text-ink" : "bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* One-liner */}
      <div>
        <p className="text-sm font-extrabold">10. One-liner</p>
        <p className="text-xs font-medium text-muted">{oneLinerPrompt}</p>
        <input
          maxLength={ONE_LINER_MAX}
          value={answers.one_liner}
          onChange={(e) => onChange({ one_liner: e.target.value })}
          className="mt-2 w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none"
          placeholder="…"
        />
        <p className="mt-1 text-right text-xs font-semibold text-muted">
          {answers.one_liner.length}/{ONE_LINER_MAX}
        </p>
      </div>
    </div>
  );
}

function TagGroup({
  n,
  title,
  hint,
  options,
  selected,
  onToggle,
}: {
  n: number;
  title: string;
  hint: string;
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const full = selected.length >= MAX_TAGS;
  return (
    <div>
      <p className="text-sm font-extrabold">
        {n}. {title}{" "}
        <span className="font-semibold text-muted">
          ({selected.length}/{MAX_TAGS})
        </span>
      </p>
      <p className="text-xs font-medium text-muted">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          const disabled = !on && full;
          return (
            <button
              key={o}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(o)}
              className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold transition-colors ${
                on
                  ? "bg-flockie-blue text-white"
                  : disabled
                    ? "bg-white text-muted/40 opacity-50"
                    : "bg-white text-ink"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
