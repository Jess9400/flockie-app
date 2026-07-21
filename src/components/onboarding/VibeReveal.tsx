"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateVibeTraits } from "@/lib/onboarding/vibe-onboarding-actions";
import { personaFromVibeTraits, type VibePersona, type VibeTraits } from "@/lib/onboarding/vibe-onboarding";
import type { VibeDisplayMatch } from "@/lib/vibe-stats";

type NearbyVibe = {
  id: string;
  title: string;
  startsAt: string;
  city: string;
  match?: VibeDisplayMatch;
};

const PERSONAS: Record<VibePersona, { emoji: string; name: string; description: string }> = {
  connector: { emoji: "🥂", name: "The Connector", description: "You bring the room together and find your people fast." },
  easygoer: { emoji: "😌", name: "The Easygoer", description: "Warm, low-key, and happiest when the plan feels easy." },
  live_wire: { emoji: "⚡", name: "The Live Wire", description: "High-energy and open to whatever makes the night more interesting." },
  deep_diver: { emoji: "💬", name: "The Deep Diver", description: "You’d rather go deep with a few than skim the surface with everyone." },
};

const GOAL_COPY: Record<string, string> = {
  crew: "a regular crew you’ll see again",
  friends: "one or two friends you really click with",
  doers: "people who’ll do the stuff you love",
  out: "a reason to get out more often",
};

export function VibeReveal({
  initialTraits,
  goal,
  nearby,
  destination,
}: {
  initialTraits: VibeTraits;
  goal: string | null;
  nearby: NearbyVibe[];
  destination: string;
}) {
  const router = useRouter();
  const t = useTranslations("vibes");
  const traitsRef = useRef(initialTraits);
  const [traits, setTraits] = useState(initialTraits);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const persona = personaFromVibeTraits(traits);
  const copy = PERSONAS[persona];

  function changeTrait(key: keyof VibeTraits, value: number) {
    const next = { ...traitsRef.current, [key]: value };
    traitsRef.current = next;
    setTraits(next);
  }

  async function persistTraits() {
    setSaving(true);
    setSaveError(false);
    try {
      await updateVibeTraits(traitsRef.current);
      return true;
    } catch {
      setSaveError(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    if (await persistTraits()) router.push(destination);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-nunito">
      <div className="bg-gradient-to-br from-[#D97058] to-flockie-coral px-6 pb-7 pt-10 text-center text-white">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/45 bg-white/15 text-[42px]">{copy.emoji}</div>
        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/75">Your Vibe</p>
        <h1 className="mt-1 text-[29px] font-black leading-none">{copy.name}</h1>
        <p className="mx-auto mt-4 max-w-[310px] text-[14px] font-semibold leading-relaxed text-white/90">You’re here for {GOAL_COPY[goal ?? ""] ?? "people and plans that feel like you"}. {copy.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-5">
        <div className="mb-6 flex items-center justify-between"><h2 className="text-[13px] font-extrabold uppercase tracking-wide text-muted">How you’re wired</h2><span className="text-[11px] font-bold text-flockie-coral">Drag to adjust</span></div>
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-4">
          <Trait labelLeft="Spontaneous" labelRight="Planner" value={traits.spontaneity} onChange={(value) => changeTrait("spontaneity", value)} onCommit={persistTraits} />
          <Trait labelLeft="Social" labelRight="Solo" value={traits.social} onChange={(value) => changeTrait("social", value)} onCommit={persistTraits} />
          <Trait labelLeft="High-energy" labelRight="Calm" value={traits.energy} onChange={(value) => changeTrait("energy", value)} onCommit={persistTraits} last />
        </div>
        <p className="mt-2 text-[11.5px] font-semibold leading-relaxed text-muted">This is your starting read. It sharpens as you join Vibes and skip the ones that aren’t you.</p>
        {saveError && <p className="mt-2 text-[11.5px] font-bold text-red-700">Couldn’t save that adjustment. Try moving the slider again.</p>}

        <section className="mt-7">
          <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-muted">Vibes near you</h2>
          {nearby.length ? (
            <div className="space-y-2.5">
              {nearby.map((vibe) => (
                <button key={vibe.id} type="button" onClick={() => router.push(`/vibes/${vibe.id}`)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white p-3 text-left">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-flockie-coral/15 text-[23px]">✨</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-extrabold text-navy">{vibe.title}</span><span className="mt-0.5 block text-[11.5px] font-semibold text-muted">{vibe.startsAt} · {vibe.city}</span></span>
                  {vibe.match?.state === "scored" && typeof vibe.match.score === "number" && <span className="rounded-full bg-flockie-blue/10 px-2 py-1 text-[10px] font-extrabold text-flockie-blue">{t("card.match", { pct: vibe.match.score })}</span>}
                  {vibe.match?.state === "new_pick" && <span className="rounded-full bg-cream px-2 py-1 text-[10px] font-extrabold text-muted">{t("card.newPick")}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-ink/15 bg-white p-5 text-center"><div className="text-3xl">🌱</div><h3 className="mt-2 text-[15px] font-extrabold text-navy">Nothing in your city yet</h3><p className="mt-1 text-[12px] font-semibold leading-relaxed text-muted">Be first to create a Vibe, or browse what’s happening in other locations.</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => router.push("/vibes/new")} className="flex-1 rounded-xl bg-flockie-coral px-3 py-2 text-[12px] font-extrabold text-white">Create a Vibe</button><button type="button" onClick={() => router.push("/vibes")} className="flex-1 rounded-xl border border-ink/20 px-3 py-2 text-[12px] font-extrabold text-navy">Browse all</button></div></div>
          )}
        </section>
      </div>

      <div className="border-t border-ink/10 bg-white px-5 py-4">
        <button type="button" onClick={finish} disabled={saving} className="w-full rounded-2xl border border-ink/15 border-b-[5px] bg-flockie-coral py-3.5 text-[15px] font-extrabold text-white disabled:opacity-50">{saving ? "Saving…" : destination === "/vibes" ? "Explore Vibes" : "Continue"}</button>
      </div>
    </div>
  );
}

function Trait({ labelLeft, labelRight, value, onChange, onCommit, last = false }: { labelLeft: string; labelRight: string; value: number; onChange: (value: number) => void; onCommit: () => void; last?: boolean }) {
  return <div className={last ? "" : "mb-5"}><div className="mb-2 flex justify-between text-[12px] font-extrabold"><span className="text-navy">{labelLeft}</span><span className="text-red-700">{labelRight}</span></div><input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} onPointerUp={onCommit} onBlur={onCommit} className="w-full accent-flockie-coral" /></div>;
}
