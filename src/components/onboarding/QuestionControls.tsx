"use client";

import { useState } from "react";
import {
  MoodQuestion,
  MultiQuestion,
  SliderQuestion,
  SwipeQuestion,
  TapQuestion,
  VibeQuestion,
} from "@/lib/onboarding/questions";
import {
  Answer,
  MoodAnswer,
  MultiAnswer,
  SliderAnswer,
  SwipeAnswer,
  TapAnswer,
} from "@/lib/onboarding/types";

export function QuestionControls({
  question,
  currentAnswer,
  disabled,
  onAnswer,
}: {
  question: VibeQuestion;
  currentAnswer?: Answer;
  disabled: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  switch (question.type) {
    case "mood":
      return <Mood question={question} current={currentAnswer as MoodAnswer} disabled={disabled} onAnswer={onAnswer} />;
    case "swipe":
      return <Swipe question={question} current={currentAnswer as SwipeAnswer} disabled={disabled} onAnswer={onAnswer} />;
    case "multi":
      return <Multi question={question} current={currentAnswer as MultiAnswer} disabled={disabled} onAnswer={onAnswer} />;
    case "slider":
      return <Slider question={question} current={currentAnswer as SliderAnswer} disabled={disabled} onAnswer={onAnswer} />;
    case "tap":
      return <Tap question={question} current={currentAnswer as TapAnswer} disabled={disabled} onAnswer={onAnswer} />;
  }
}

function Mood({ question, current, disabled, onAnswer }: { question: MoodQuestion; current?: MoodAnswer; disabled: boolean; onAnswer: (answer: Answer) => void }) {
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      {question.options.map((option, index) => (
        <button
          key={option.label}
          type="button"
          disabled={disabled}
          onClick={() => onAnswer({ type: "mood", index })}
          style={{ background: `linear-gradient(135deg, ${option.gradientFrom}, ${option.gradientTo})` }}
          className={`relative flex h-[88px] items-center gap-3.5 rounded-2xl border-[3px] px-4 text-left transition-transform disabled:opacity-60 ${current?.index === index ? "scale-[0.98] border-white" : "border-transparent"}`}
        >
          <span className="text-3xl">{option.emoji}</span>
          <span className="text-[14.5px] font-extrabold leading-tight text-white">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function Swipe({ question, current, disabled, onAnswer }: { question: SwipeQuestion; current?: SwipeAnswer; disabled: boolean; onAnswer: (answer: Answer) => void }) {
  const [flying, setFlying] = useState<"left" | "right" | null>(null);

  function choose(side: "left" | "right") {
    setFlying(side);
    window.setTimeout(() => onAnswer({ type: "swipe", side }), 300);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className={`relative w-full rounded-[20px] border-2 border-ink/15 bg-white px-5 py-8 text-center text-4xl shadow-lg transition-all duration-300 ${flying === "left" ? "-translate-x-[150%] -rotate-[18deg] opacity-0" : flying === "right" ? "translate-x-[150%] rotate-[18deg] opacity-0" : ""}`}>
        {current && <span className="absolute -top-2.5 right-3.5 rounded-full bg-onboarding-green px-2.5 py-1 text-[10px] font-extrabold text-white">Saved {current.side === "right" ? question.right.emoji : question.left.emoji}</span>}
        🤔
      </div>
      <div className="mt-5 flex w-full gap-3.5">
        {[question.left, question.right].map((option, index) => {
          const side = index === 0 ? "left" : "right";
          return (
            <button key={side} type="button" disabled={disabled || Boolean(flying)} onClick={() => choose(side)} className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-b-4 py-3.5 text-[13.5px] font-extrabold disabled:opacity-60 ${side === "right" ? "border-flockie-coral bg-flockie-coral/10 text-red-700" : "border-ink/15 bg-white text-muted"}`}>
              <span className="text-2xl">{option.emoji}</span>{option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Multi({ question, current, disabled, onAnswer }: { question: MultiQuestion; current?: MultiAnswer; disabled: boolean; onAnswer: (answer: Answer) => void }) {
  const [selected, setSelected] = useState<number[]>(current?.indices ?? []);
  function toggle(index: number) {
    setSelected((previous) => previous.includes(index) ? previous.filter((item) => item !== index) : previous.length < question.maxSelect ? [...previous, index] : previous);
  }
  return (
    <div className="flex flex-1 flex-col">
      <div className="grid flex-1 grid-cols-2 gap-2">
        {question.options.map((option, index) => {
          const active = selected.includes(index);
          return <button key={option.label} type="button" disabled={disabled} onClick={() => toggle(index)} className={`rounded-2xl border-2 border-b-4 px-2 py-3 text-center ${active ? "border-flockie-coral bg-flockie-coral/10" : "border-ink/15 bg-white"}`}><span className="mb-1 block text-[22px]">{option.emoji}</span><span className="text-[12px] font-bold">{option.label}</span></button>;
        })}
      </div>
      <Continue disabled={disabled || selected.length === 0} onClick={() => onAnswer({ type: "multi", indices: selected })} />
    </div>
  );
}

function Slider({ question, current, disabled, onAnswer }: { question: SliderQuestion; current?: SliderAnswer; disabled: boolean; onAnswer: (answer: Answer) => void }) {
  const [value, setValue] = useState(current?.value ?? 50);
  return (
    <div className="flex flex-1 flex-col justify-center pt-2.5">
      <input type="range" min={0} max={100} value={value} disabled={disabled} onChange={(event) => setValue(Number(event.target.value))} className="vibe-slider my-5" />
      <div className="flex justify-between text-[12.5px] font-bold"><span className="text-navy">{question.leftLabel}</span><span className="text-red-700">{question.rightLabel}</span></div>
      <Continue disabled={disabled} onClick={() => onAnswer({ type: "slider", value })} />
    </div>
  );
}

function Tap({ question, current, disabled, onAnswer }: { question: TapQuestion; current?: TapAnswer; disabled: boolean; onAnswer: (answer: Answer) => void }) {
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      {question.options.map((option, index) => <button key={option.label} type="button" disabled={disabled} onClick={() => onAnswer({ type: "tap", index })} className={`flex items-center gap-3 rounded-2xl border-2 border-b-4 px-4 py-3.5 text-left text-[14px] font-bold disabled:opacity-60 ${current?.index === index ? "border-flockie-coral bg-flockie-coral/10" : "border-ink/15 bg-white"}`}><span className="text-xl">{option.emoji}</span>{option.label}</button>)}
    </div>
  );
}

function Continue({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="mt-3.5 w-full rounded-2xl border-2 border-ink border-b-[5px] bg-navy py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40">Continue →</button>;
}
