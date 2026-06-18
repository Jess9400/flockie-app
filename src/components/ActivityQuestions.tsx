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
    <div className="space-y-7">
      {/* Section A: what you do */}
      <div>
        <p className="text-sm font-extrabold">What you actually do</p>
        <p className="text-xs font-medium text-muted">
          Pick all that apply. No limit.
        </p>
        <div className="mt-3 space-y-4">
          {ACTIVITY_CATEGORIES.map((cat) => (
            <div key={cat.group}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                {cat.group}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((a) => {
                  const on = answers.activities.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleActivity(a)}
                      className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${
                        on ? "bg-flockie-blue text-white" : "bg-white text-ink"
                      }`}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section B1: skill level per selected activity */}
      {answers.activities.length > 0 && (
        <div>
          <p className="text-sm font-extrabold">Your skill level</p>
          <p className="text-xs font-medium text-muted">
            For each thing you picked.
          </p>
          <div className="mt-3 space-y-4">
            {answers.activities.map((a) => {
              const val = answers.activity_skills[a] ?? null;
              return (
                <div key={a}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{a}</span>
                    <span
                      className={`text-xs font-bold ${
                        val == null ? "text-muted" : "text-flockie-orange"
                      }`}
                    >
                      {val == null ? "set level" : SKILL_SCALE[val - 1]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={val ?? 3}
                    onChange={(e) => setSkill(a, Number(e.target.value))}
                    className="mt-1 w-full accent-flockie-orange"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section B2/B3: social style + intensity */}
      <Slider
        label="Activity social style"
        prompt="When you do an activity, do you prefer to…"
        scale={ACTIVITY_SOCIAL_SCALE}
        value={answers.activity_social}
        onChange={(v) => onChange({ activity_social: v })}
      />
      <Slider
        label="Intensity preference"
        prompt="How hard do you want to push?"
        scale={INTENSITY_SCALE}
        value={answers.activity_intensity}
        onChange={(v) => onChange({ activity_intensity: v })}
      />

      {/* Section B4: vibe, max 2 */}
      <div>
        <p className="text-sm font-extrabold">
          Ideal experience vibe{" "}
          <span className="font-semibold text-muted">
            ({answers.activity_vibe.length}/{ACTIVITY_VIBE_MAX})
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACTIVITY_VIBES.map((v) => {
            const on = answers.activity_vibe.includes(v);
            const disabled = !on && vibeFull;
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                onClick={() => toggleVibe(v)}
                className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${
                  on
                    ? "bg-flockie-blue text-white"
                    : disabled
                      ? "bg-white text-muted/40 opacity-50"
                      : "bg-white text-ink"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section C: dealbreakers */}
      <div>
        <p className="text-sm font-extrabold">Hard preferences</p>
        <div className="mt-2 space-y-2">
          {ACTIVITY_DEALBREAKERS.map((d) => {
            const on = answers.activity_dealbreakers.includes(d);
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

      {/* Section D: one-liner */}
      <div>
        <p className="text-sm font-extrabold">One-liner</p>
        <p className="text-xs font-medium text-muted">{ACTIVITY_ONE_LINER_PROMPT}</p>
        <input
          maxLength={ONE_LINER_MAX}
          value={answers.activity_one_liner}
          onChange={(e) => onChange({ activity_one_liner: e.target.value })}
          className="mt-2 w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none"
          placeholder="…"
        />
        <p className="mt-1 text-right text-xs font-semibold text-muted">
          {answers.activity_one_liner.length}/{ONE_LINER_MAX}
        </p>
      </div>
    </div>
  );
}

function Slider({
  label,
  prompt,
  scale,
  value,
  onChange,
}: {
  label: string;
  prompt: string;
  scale: readonly string[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-extrabold">{label}</p>
      <p className="text-xs font-medium text-muted">{prompt}</p>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value ?? 3}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-flockie-orange"
      />
      <p
        className={`mt-1 text-sm font-bold ${
          value == null ? "text-muted" : "text-flockie-orange"
        }`}
      >
        {value == null ? "Slide to answer" : scale[value - 1]}
      </p>
    </div>
  );
}
