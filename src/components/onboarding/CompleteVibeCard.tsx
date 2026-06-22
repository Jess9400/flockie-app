import Link from "next/link";
import { Compass, PartyPopper, ChevronRight, Check, Lock } from "lucide-react";

// "Complete your vibe" hub shown on the reveal screen. The personality vibe
// check counts as the first of three pieces (the user just took it), so
// progress = personality + trip + activity. Each card links to the matching
// form; a filled one shows a check instead of its question-count badge.
export default function CompleteVibeCard({
  tripDone,
  activityDone,
}: {
  tripDone: boolean;
  activityDone: boolean;
}) {
  const done = 1 + (tripDone ? 1 : 0) + (activityDone ? 1 : 0);
  const percent = Math.round((done / 3) * 100);
  const all = done === 3;

  return (
    <section className="rounded-3xl border-2 border-ink/10 bg-white p-5 shadow-[0_4px_0_0_rgba(26,26,26,0.06)]">
      <Ring percent={percent} />

      <h2 className="mt-4 text-center text-[20px] font-black leading-tight text-ink">
        {all ? "Your vibe's complete 🎉" : "You're almost there"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-[300px] text-center text-[12.5px] font-medium leading-relaxed text-muted">
        {all
          ? "All three pieces are in — your matches are as sharp as they get."
          : "Each piece makes your matches sharper. Add them now, or they fill in as you travel and join things."}
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        <VibeRow
          href="/onboarding/trip-vibe"
          icon={<Compass size={20} />}
          iconClass="bg-flockie-blue/15 text-flockie-blue"
          title="Travel Vibe"
          desc="Pace, budget, how you travel — sharpens trip matches"
          questions={9}
          done={tripDone}
        />
        <VibeRow
          href="/onboarding/activity-vibe"
          icon={<PartyPopper size={20} />}
          iconClass="bg-flockie-coral/15 text-flockie-coral"
          title="Event Vibe"
          desc="What you want from a night out, group size — sharpens local plans"
          questions={9}
          done={activityDone}
        />
      </div>

      {all ? (
        <Link
          href="/profile?vibe_done=1"
          className="mt-4 block w-full rounded-2xl border-2 border-ink border-b-[5px] bg-flockie-coral py-3.5 text-center text-[15px] font-extrabold text-white"
        >
          See your full reading →
        </Link>
      ) : (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-cream/60 p-4 text-center">
          <Lock size={18} className="mx-auto mb-1.5 text-muted" />
          <p className="text-[13px] font-extrabold text-ink">Your full reading unlocks at 100%</p>
          <p className="mt-1 text-[11.5px] font-semibold leading-relaxed text-muted">
            Finish all three to get the complete read on who you are.
          </p>
        </div>
      )}
    </section>
  );
}

// Circular progress ring with the percentage in the middle.
function Ring({ percent }: { percent: number }) {
  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EFE7DA" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.915"
          fill="none"
          stroke="#FF6B4A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${percent} ${100 - percent}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[24px] font-black leading-none text-ink">{percent}%</span>
        <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wide text-muted">Complete</span>
      </div>
    </div>
  );
}

function VibeRow({
  href,
  icon,
  iconClass,
  title,
  desc,
  questions,
  done,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  desc: string;
  questions: number;
  done: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white p-3 transition-colors hover:bg-cream"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight text-ink">{title}</p>
        <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-muted">{desc}</p>
      </div>
      {done ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-onboarding-green text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-flockie-coral/15 px-2 py-0.5 text-[11px] font-extrabold text-flockie-coral">
          {questions} q
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </Link>
  );
}
