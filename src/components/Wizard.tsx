"use client";

import { useState } from "react";
import { ChevronLeft, X } from "lucide-react";

// A page-based wizard: each page holds a small group of fields, styled like the
// onboarding screenshots (coral progress bar, kicker, card/slider/badge controls).
// Honors explicit page counts (Activity = 2 pages, Trip ≤ 5 pages).

export type WizardField =
  | {
      type: "select";
      key: string;
      label: string;
      hint?: string;
      required?: boolean;
      options: { value: string; label: string; emoji?: string }[];
    }
  | {
      type: "multi";
      key: string;
      label: string;
      hint?: string;
      required?: boolean;
      max?: number;
      options: { value: string; label: string; emoji?: string }[];
    }
  | {
      type: "slider";
      key: string;
      label: string;
      hint?: string;
      left: string;
      right: string;
      labels: [string, string, string, string, string];
    }
  | {
      type: "skills";
      key: string; // stored as Record<categoryLabel, 1..5>
      label: string;
      hint?: string;
      categories: { value: string; label: string; emoji?: string }[];
      labels: [string, string, string, string, string];
    }
  | {
      type: "text";
      key: string;
      label: string;
      hint?: string;
      placeholder?: string;
      max?: number;
      required?: boolean;
    };

export type WizardPage = { title: string; subtitle?: string; fields: WizardField[] };

export type WizardValue = string | string[] | number | Record<string, number>;
export type WizardAnswers = Record<string, WizardValue>;

function Emoji({ children }: { children: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-lg leading-none">
      {children}
    </span>
  );
}

function fieldComplete(f: WizardField, ans: WizardAnswers): boolean {
  if (f.type === "select") return !f.required || typeof ans[f.key] === "string";
  if (f.type === "multi") return !f.required || ((ans[f.key] as string[]) ?? []).length > 0;
  if (f.type === "text") return !f.required || ((ans[f.key] as string) ?? "").trim().length > 0;
  return true; // sliders / skills always have a value
}

export default function Wizard({
  title,
  pages,
  initial,
  submitting,
  finishLabel = "Finish",
  onComplete,
  onClose,
}: {
  title?: string;
  pages: WizardPage[];
  initial?: WizardAnswers;
  submitting?: boolean;
  finishLabel?: string;
  onComplete: (answers: WizardAnswers) => void;
  onClose?: () => void;
}) {
  const [p, setP] = useState(0);
  const [ans, setAns] = useState<WizardAnswers>(initial ?? {});
  const page = pages[p];
  const n = pages.length;
  const pct = Math.round(((p + 1) / n) * 100);
  const last = p === n - 1;

  function set(key: string, v: WizardValue) {
    setAns((a) => ({ ...a, [key]: v }));
  }
  function next() {
    if (!last) setP(p + 1);
    else onComplete(ans);
  }
  function back() {
    if (p > 0) setP(p - 1);
  }

  const canContinue = page.fields.every((f) => fieldComplete(f, ans));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream font-nunito">
      <div className="flex items-center gap-3 px-5 pb-2 pt-5">
        {p > 0 ? (
          <button onClick={back} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy bg-white text-navy">
            <ChevronLeft size={18} />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-navy bg-white">
          <div className="h-full rounded-full bg-flockie-coral transition-all" style={{ width: `${pct}%` }} />
        </div>
        {onClose ? (
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy bg-white text-navy">
            <X size={18} />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
        <div className="mx-auto max-w-md">
          <p className="font-nunito text-xs font-extrabold uppercase tracking-wide text-flockie-coral">
            {title ? `${title} · ` : ""}Step {p + 1} of {n}
          </p>
          <h2 className="mt-1 font-fredoka text-2xl font-bold leading-tight text-navy">{page.title}</h2>
          {page.subtitle && <p className="mt-1 font-nunito text-sm font-medium text-navy/55">{page.subtitle}</p>}

          <div className="mt-7 space-y-9">
            {page.fields.map((f) => (
              <Field key={f.key} field={f} value={ans[f.key]} onChange={(v) => set(f.key, v)} />
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            disabled={!canContinue || submitting}
            className="mt-9 w-full rounded-full border-2 border-navy bg-navy py-3.5 font-fredoka text-base font-semibold text-white disabled:opacity-40"
          >
            {submitting && last ? "Saving…" : last ? finishLabel : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: WizardField;
  value: WizardValue | undefined;
  onChange: (v: WizardValue) => void;
}) {
  return (
    <div>
      <p className="font-fredoka text-lg font-semibold leading-snug text-navy">{field.label}</p>
      {field.hint && <p className="mt-0.5 font-nunito text-sm font-medium text-navy/55">{field.hint}</p>}

      {field.type === "select" && (
        <div className={`mt-3 ${field.options.length === 2 ? "grid grid-cols-2 gap-3" : "space-y-2.5"}`}>
          {field.options.map((o) => {
            const on = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left font-nunito text-[15px] font-semibold transition-colors ${
                  on ? "border-navy bg-flockie-coral text-white" : "border-navy bg-white text-navy hover:bg-cream"
                }`}
              >
                {o.emoji && <Emoji>{o.emoji}</Emoji>}
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {field.type === "multi" && (
        <MultiField field={field} value={(value as string[]) ?? []} onChange={onChange} />
      )}

      {field.type === "slider" && (
        <SliderField left={field.left} right={field.right} labels={field.labels} value={(value as number) ?? 3} onChange={onChange} />
      )}

      {field.type === "skills" && (
        <div className="mt-3 space-y-5">
          {field.categories.map((c) => {
            const map = (value as Record<string, number>) ?? {};
            return (
              <div key={c.value}>
                <p className="mb-2 flex items-center gap-2 font-nunito text-sm font-bold text-navy">
                  {c.emoji && <span>{c.emoji}</span>} {c.label}
                </p>
                <SliderField
                  left="New to it"
                  right="Pro"
                  labels={field.labels}
                  value={map[c.value] ?? 3}
                  onChange={(v) => onChange({ ...map, [c.value]: v as number })}
                  compact
                />
              </div>
            );
          })}
        </div>
      )}

      {field.type === "text" && (
        <>
          <input
            maxLength={field.max ?? 100}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="mt-3 h-14 w-full rounded-2xl border-2 border-navy bg-white px-4 font-nunito text-base font-medium text-navy outline-none focus:border-flockie-blue"
          />
          <p className="mt-1 text-right font-nunito text-xs font-semibold text-navy/50">
            {((value as string) ?? "").length}/{field.max ?? 100}
          </p>
        </>
      )}
    </div>
  );
}

function MultiField({
  field,
  value,
  onChange,
}: {
  field: Extract<WizardField, { type: "multi" }>;
  value: string[];
  onChange: (v: WizardValue) => void;
}) {
  const max = field.max ?? 99;
  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (value.length < max) onChange([...value, v]);
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5">
      {field.options.map((o) => {
        const on = value.includes(o.value);
        const full = !on && value.length >= max;
        return (
          <button
            key={o.value}
            type="button"
            disabled={full}
            onClick={() => toggle(o.value)}
            className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left font-nunito text-[13px] font-semibold transition-colors ${
              on
                ? "border-navy bg-flockie-coral text-white"
                : full
                  ? "border-navy/20 bg-white text-navy/30"
                  : "border-navy bg-white text-navy hover:bg-cream"
            }`}
          >
            {o.emoji && <span className="text-base">{o.emoji}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SliderField({
  left,
  right,
  labels,
  value,
  onChange,
  compact,
}: {
  left: string;
  right: string;
  labels: [string, string, string, string, string];
  value: number;
  onChange: (v: WizardValue) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "mt-4"}>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full appearance-none rounded-full bg-gradient-to-r from-flockie-blue to-flockie-coral accent-flockie-coral"
      />
      <div className="mt-1.5 flex items-center justify-between font-nunito text-xs font-bold">
        <span className="text-flockie-blue">{left}</span>
        <span className="text-flockie-coral">{right}</span>
      </div>
      <p className={`mt-2 text-center font-fredoka font-semibold text-navy ${compact ? "text-sm" : "rounded-2xl border-2 border-navy bg-white py-2.5"}`}>
        {labels[value - 1]}
      </p>
    </div>
  );
}
