"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle, X } from "lucide-react";

export type PlanInvited = { id: string; title: string; meta: string; href: string };
export type PlanConfirmed = {
  id: string;
  title: string;
  meta: string;
  chatUrl: string;
  directionsUrl: string;
};

const KEY = "flockie:dismissed-plans";

// "Your plans" cards on Home, with a per-card ✕ to dismiss (remembered in
// localStorage so it stays hidden across visits).
export default function HomePlans({
  invited,
  confirmed,
  labels,
}: {
  invited: PlanInvited[];
  confirmed: PlanConfirmed[];
  labels: {
    heading: string;
    invited: string;
    confirm: string;
    youreIn: string;
    openChat: string;
    directions: string;
    dismiss: string;
  };
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(new Set(JSON.parse(localStorage.getItem(KEY) || "[]")));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!ready) return null;
  const inv = invited.filter((p) => !dismissed.has(p.id));
  const conf = confirmed.filter((p) => !dismissed.has(p.id));
  if (inv.length === 0 && conf.length === 0) return null;

  return (
    <section className="mx-4 mt-6 space-y-3">
      <h2 className="px-1 text-[22px] font-extrabold sm:text-[28px]">{labels.heading}</h2>

      {inv.map((p) => (
        <div key={p.id} className="relative rounded-2xl border-2 border-flockie-coral bg-white p-3">
          <DismissBtn label={labels.dismiss} onClick={() => dismiss(p.id)} />
          <div className="flex items-center gap-3 pr-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-flockie-coral/10 text-lg">
              ✉️
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">
                {labels.invited} · {p.title}
              </p>
              <p className="truncate text-xs font-medium text-muted">{p.meta}</p>
            </div>
            <Link
              href={p.href}
              className="shrink-0 rounded-full border-2 border-ink bg-flockie-coral px-4 py-2 text-xs font-bold text-white shadow-[0_2px_0_0_#E0512C]"
            >
              {labels.confirm}
            </Link>
          </div>
        </div>
      ))}

      {conf.map((p) => (
        <div key={p.id} className="relative rounded-2xl border-2 border-onboarding-green bg-[#E9F6F1] p-3">
          <DismissBtn label={labels.dismiss} onClick={() => dismiss(p.id)} />
          <div className="flex items-center gap-3 pr-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-onboarding-green/15 text-lg">
              🎉
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{p.title}</p>
              <p className="truncate text-xs font-medium text-muted">{p.meta}</p>
            </div>
            <span className="shrink-0 rounded-full bg-onboarding-green px-2.5 py-1 text-[11px] font-extrabold text-white">
              {labels.youreIn}
            </span>
          </div>
          <div className="mt-2.5 flex gap-2">
            <Link
              href={p.chatUrl}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-white py-2 text-xs font-bold text-ink"
            >
              <MessageCircle size={14} /> {labels.openChat}
            </Link>
            <a
              href={p.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-white py-2 text-xs font-bold text-ink"
            >
              <MapPin size={14} /> {labels.directions}
            </a>
          </div>
        </div>
      ))}
    </section>
  );
}

function DismissBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-2 top-2 rounded-full p-1 text-ink/40 hover:bg-white/60 hover:text-ink"
    >
      <X size={15} />
    </button>
  );
}
