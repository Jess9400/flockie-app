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
import RangeSlider from "@/components/RangeSlider";
import { Chip, TogglePill, Counter } from "@/components/profileControls";

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
    <div className="space-y-9">
      {/* 6 sliders */}
      {SLIDERS.map((s, i) => (
        <div key={s.key}>
          <p className="font-nunito text-[15px] font-semibold text-navy">
            {i + 1}. {s.label}
          </p>
          <p className="mb-3 font-nunito text-sm font-normal text-navy/60">{s.prompt}</p>
          <RangeSlider
            value={answers[s.key]}
            onChange={(v) => onChange({ [s.key]: v } as Partial<VibeAnswers>)}
            scale={s.scale}
            label={s.label}
          />
        </div>
      ))}

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

      {/* Dealbreakers — toggle pills */}
      <div>
        <p className="font-nunito text-[15px] font-semibold text-navy">9. Hard preferences</p>
        <p className="mb-3 font-nunito text-sm font-normal text-navy/60">
          Tick what applies. These are used as hard filters.
        </p>
        <div className="space-y-3">
          {DEALBREAKERS.map((d) => (
            <TogglePill
              key={d}
              label={d}
              selected={answers.dealbreakers.includes(d)}
              onClick={() => toggleDealbreaker(d)}
            />
          ))}
        </div>
      </div>

      {/* One-liner */}
      <div>
        <p className="font-nunito text-[15px] font-semibold text-navy">10. One-liner</p>
        <p className="mb-3 font-nunito text-sm font-normal text-navy/60">{oneLinerPrompt}</p>
        <input
          maxLength={ONE_LINER_MAX}
          value={answers.one_liner}
          onChange={(e) => onChange({ one_liner: e.target.value })}
          className={inputCls}
          placeholder="…"
        />
        <p className="mt-1 text-right font-nunito text-xs font-semibold text-navy/50">
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
      <p className="font-nunito text-[15px] font-semibold text-navy">
        {n}. {title} <Counter n={selected.length} max={MAX_TAGS} />
      </p>
      <p className="mb-3 font-nunito text-sm font-normal text-navy/60">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip
            key={o}
            label={o}
            selected={selected.includes(o)}
            disabled={full}
            onClick={() => onToggle(o)}
          />
        ))}
      </div>
    </div>
  );
}

const inputCls =
  "h-14 w-full rounded-2xl border-2 border-navy bg-cream px-4 font-nunito text-base font-medium text-navy outline-none focus:border-flockie-blue";
