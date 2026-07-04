"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("vibeCheck");
  const tc = useTranslations("components");
  // Data-driven labels with a raw-text fallback for any unmapped value.
  const tripVibeLabel = (v: string) => (tc.has(`tripTypes.${v}`) ? tc(`tripTypes.${v}`) : v);
  const travelStyleLabel = (v: string) => (t.has(`travelStyles.${v}`) ? t(`travelStyles.${v}`) : v);

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
      {SLIDERS.map((s, i) => {
        const label = t.has(`sliders.${s.key}.label`) ? t(`sliders.${s.key}.label`) : s.label;
        const prompt = t.has(`sliders.${s.key}.prompt`) ? t(`sliders.${s.key}.prompt`) : s.prompt;
        const scale = (t.has(`sliders.${s.key}.scale`) ? (t.raw(`sliders.${s.key}.scale`) as string[]) : s.scale) as typeof s.scale;
        return (
          <div key={s.key}>
            <p className="font-nunito text-[15px] font-semibold text-navy">
              {i + 1}. {label}
            </p>
            <p className="mb-3 font-nunito text-sm font-normal text-navy/60">{prompt}</p>
            <RangeSlider
              value={answers[s.key]}
              onChange={(v) => onChange({ [s.key]: v } as Partial<VibeAnswers>)}
              scale={scale}
              label={label}
            />
          </div>
        );
      })}

      {/* Trip vibe — max 3 */}
      <TagGroup
        n={7}
        title={t("forms.questions.tripVibeTitle")}
        hint={t("forms.questions.tripVibeHint", { max: MAX_TAGS })}
        options={TRIP_VIBES}
        labelFor={tripVibeLabel}
        selected={answers.trip_vibe}
        onToggle={(v) => toggleTag("trip_vibe", v)}
      />

      {/* Travel style — max 3 */}
      <TagGroup
        n={8}
        title={t("forms.questions.travelStyleTitle")}
        hint={t("forms.questions.travelStyleHint", { max: MAX_TAGS })}
        options={TRAVEL_STYLES}
        labelFor={travelStyleLabel}
        selected={answers.travel_style}
        onToggle={(v) => toggleTag("travel_style", v)}
      />

      {/* Dealbreakers — toggle pills */}
      <div>
        <p className="font-nunito text-[15px] font-semibold text-navy">9. {t("forms.questions.hardPrefsTitle")}</p>
        <p className="mb-3 font-nunito text-sm font-normal text-navy/60">
          {t("forms.questions.hardPrefsHint")}
        </p>
        <div className="space-y-3">
          {DEALBREAKERS.map((d) => (
            <TogglePill
              key={d}
              label={t.has(`dealbreakers.${d}`) ? t(`dealbreakers.${d}`) : d}
              selected={answers.dealbreakers.includes(d)}
              onClick={() => toggleDealbreaker(d)}
            />
          ))}
        </div>
      </div>

      {/* One-liner */}
      <div>
        <p className="font-nunito text-[15px] font-semibold text-navy">10. {t("forms.questions.oneLinerTitle")}</p>
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
  labelFor,
  selected,
  onToggle,
}: {
  n: number;
  title: string;
  hint: string;
  options: readonly string[];
  labelFor: (v: string) => string;
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
            label={labelFor(o)}
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
