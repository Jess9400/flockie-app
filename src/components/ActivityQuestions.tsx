"use client";

import {
  ACTIVITY_CATEGORIES,
  SKILL_SCALE,
  ACTIVITY_SOCIAL_SCALE,
  INTENSITY_SCALE,
  ACTIVITY_VIBES,
  ACTIVITY_VIBE_MAX,
  ACTIVITY_DEALBREAKERS,
  ACTIVITY_ONE_LINER_PROMPT,
  ONE_LINER_MAX,
  type ActivityAnswers,
} from "@/lib/vibe-check";
import RangeSlider from "@/components/RangeSlider";
import { Chip, TogglePill, Counter } from "@/components/profileControls";

type Props = {
  answers: ActivityAnswers;
  onChange: (patch: Partial<ActivityAnswers>) => void;
};

export default function ActivityQuestions({ answers, onChange }: Props) {
  function toggleActivity(value: string) {
    if (answers.activities.includes(value)) {
      const skills = { ...answers.activity_skills };
      delete skills[value];
      onChange({
        activities: answers.activities.filter((a) => a !== value),
        activity_skills: skills,
      });
    } else {
      onChange({ activities: [...answers.activities, value] });
    }
  }

  function setSkill(activity: string, val: number) {
    onChange({ activity_skills: { ...answers.activity_skills, [activity]: val } });
  }

  function toggleVibe(value: string) {
    const list = answers.activity_vibe;
    if (list.includes(value)) {
      onChange({ activity_vibe: list.filter((v) => v !== value) });
    } else if (list.length < ACTIVITY_VIBE_MAX) {
      onChange({ activity_vibe: [...list, value] });
    }
  }

  function toggleDealbreaker(value: string) {
    const list = answers.activity_dealbreakers;
    onChange({
      activity_dealbreakers: list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    });
  }

  const vibeFull = answers.activity_vibe.length >= ACTIVITY_VIBE_MAX;

  return (
    <div className="space-y-9">
      {/* What you do */}
      <div>
        <p className="font-nunito text-[15px] font-semibold text-navy">What you actually do</p>
        <p className="mb-3 font-nunito text-sm font-normal text-navy/60">
          Pick all that apply. No limit.
        </p>
        <div className="space-y-4">
          {ACTIVITY_CATEGORIES.map((cat) => (
            <div key={cat.group}>
              <p className="mb-2 font-nunito text-[11px] font-bold uppercase tracking-wide text-navy/55">
                {cat.group}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    selected={answers.activities.includes(a)}
                    onClick={() => toggleActivity(a)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Skill per activity */}
      {answers.activities.length > 0 && (
        <div>
          <p className="font-nunito text-[15px] font-semibold text-navy">Your skill level</p>
          <p className="mb-3 font-nunito text-sm font-normal text-navy/60">
            For each thing you picked.
          </p>
          <div className="space-y-6">
            {answers.activities.map((a) => (
              <div key={a}>
                <p className="mb-2 font-nunito text-sm font-semibold text-navy">{a}</p>
                <RangeSlider
                  value={answers.activity_skills[a] ?? null}
                  onChange={(v) => setSkill(a, v)}
                  scale={SKILL_SCALE}
                  label={`${a} skill`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social + intensity */}
      <div>
        <p className="font-nunito text-[15px] font-semibold text-navy">Activity social style</p>
        <p className="mb-3 font-nunito text-sm font-normal text-navy/60">
          When you do an activity, do you prefer to…
        </p>
        <RangeSlider
          value={answers.activity_social}
          onChange={(v) => onChange({ activity_social: v })}
          scale={ACTIVITY_SOCIAL_SCALE}
          label="Activity social style"
        />
      </div>
      <div>
        <p className="font-nunito text-[15px] font-semibold text-navy">Intensity preference</p>
        <p className="mb-3 font-nunito text-sm font-normal text-navy/60">
          How hard do you want to push?
        </p>
        <RangeSlider
          value={answers.activity_intensity}
          onChange={(v) => onChange({ activity_intensity: v })}
          scale={INTENSITY_SCALE}
          label="Intensity preference"
        />
      </div>

      {/* Vibe — max 2 */}
      <div>
        <p className="font-nunito text-[15px] font-semibold text-navy">
          Ideal experience vibe <Counter n={answers.activity_vibe.length} max={ACTIVITY_VIBE_MAX} />
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIVITY_VIBES.map((v) => (
            <Chip
              key={v}
              label={v}
              selected={answers.activity_vibe.includes(v)}
              disabled={vibeFull}
              onClick={() => toggleVibe(v)}
            />
          ))}
        </div>
      </div>

      {/* Dealbreakers — toggle pills */}
      <div>
        <p className="mb-3 font-nunito text-[15px] font-semibold text-navy">Hard preferences</p>
        <div className="space-y-3">
          {ACTIVITY_DEALBREAKERS.map((d) => (
            <TogglePill
              key={d}
              label={d}
              selected={answers.activity_dealbreakers.includes(d)}
              onClick={() => toggleDealbreaker(d)}
            />
          ))}
        </div>
      </div>

      {/* One-liner */}
      <div>
        <p className="mb-3 font-nunito text-[15px] font-semibold text-navy">{ACTIVITY_ONE_LINER_PROMPT}</p>
        <input
          maxLength={ONE_LINER_MAX}
          value={answers.activity_one_liner}
          onChange={(e) => onChange({ activity_one_liner: e.target.value })}
          className="h-14 w-full rounded-2xl border-2 border-navy bg-cream px-4 font-nunito text-base font-medium text-navy outline-none focus:border-flockie-blue"
          placeholder="…"
        />
        <p className="mt-1 text-right font-nunito text-xs font-semibold text-navy/50">
          {answers.activity_one_liner.length}/{ONE_LINER_MAX}
        </p>
      </div>
    </div>
  );
}
