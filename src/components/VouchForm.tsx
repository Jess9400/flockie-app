"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import VibeQuestions from "@/components/VibeQuestions";
import { EMPTY_ANSWERS, ONE_LINER_MAX, type VibeAnswers } from "@/lib/vibe-check";
import { useTranslations } from "next-intl";

export default function VouchForm({ token }: { token: string }) {
  const t = useTranslations("components");
  const supabase = createClient();
  const [name, setName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [answers, setAnswers] = useState<VibeAnswers>(EMPTY_ANSWERS);
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_vouch_subject", { p_token: token });
      setName((data as string | null) ?? null);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const { error } = await supabase.rpc("submit_vouch", {
      p_token: token,
      p_friend_name: friendName || null,
      p_planning: answers.planning,
      p_pace: answers.pace,
      p_social_energy: answers.social_energy,
      p_budget: answers.budget,
      p_nightlife: answers.nightlife,
      p_adventurousness: answers.adventurousness,
      p_trip_vibe: answers.trip_vibe,
      p_travel_style: answers.travel_style,
      p_dealbreakers: answers.dealbreakers,
      p_one_liner: answers.one_liner || null,
      p_extra_note: extra || null,
    });
    setSaving(false);
    if (error) return setErr(t("vouchForm.errorGeneric"));
    setDone(true);
  }

  if (!loaded) {
    return <p className="py-20 text-center font-semibold text-muted">{t("vouchForm.loading")}</p>;
  }

  if (name === null) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-black">{t("vouchForm.linkNotFoundHeading")}</h1>
        <p className="mt-2 font-medium text-muted">
          {t("vouchForm.linkNotFoundBody")}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-3xl font-black">{t("vouchForm.thankYouHeading")}</h1>
        <p className="mt-2 font-medium text-muted">
          {t("vouchForm.thankYouBody", { name })}
        </p>
      </div>
    );
  }

  const who = name || t("vouchForm.defaultWho");

  return (
    <form onSubmit={submit} className="space-y-7 pb-10">
      <header>
        <h1 className="text-2xl font-black">
          {t("vouchForm.planningHeading", { who })}
        </h1>
        <p className="mt-1 font-medium text-muted">
          {t("vouchForm.planningBody", { who })}
        </p>
        <p className="mt-3 rounded-2xl border border-ink/10 bg-ink/5 p-3 text-xs font-medium leading-relaxed text-muted">
          {t("vouchForm.legalText", { who })}<a href="mailto:hello@findflockie.com" className="font-bold underline underline-offset-2">
            hello@findflockie.com
          </a>
          .
        </p>
      </header>

      <label className="block">
        <span className="mb-1 block text-sm font-bold">{t("vouchForm.nameLabel")}</span>
        <input
          value={friendName}
          onChange={(e) => setFriendName(e.target.value)}
          className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-2.5 font-medium outline-none"
          placeholder={t("vouchForm.namePlaceholder")}
        />
      </label>

      <VibeQuestions
        answers={answers}
        onChange={(patch) => setAnswers((a) => ({ ...a, ...patch }))}
        oneLinerPrompt={t("vouchForm.oneLinerPrompt", { who })}
      />

      <label className="block">
        <span className="mb-1 block text-sm font-bold">
          {t("vouchForm.extraLabel")}
        </span>
        <textarea
          value={extra}
          maxLength={ONE_LINER_MAX * 3}
          onChange={(e) => setExtra(e.target.value)}
          className="h-24 w-full resize-none rounded-2xl border border-ink/15 bg-white px-4 py-2.5 font-medium outline-none"
          placeholder={t("vouchForm.extraPlaceholder")}
        />
      </label>

      {err && <p className="text-center text-sm font-bold text-flockie-orange">{err}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full border border-ink/15 bg-flockie-orange py-3.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        {saving ? t("vouchForm.sending") : t("vouchForm.vouchFor", { who })}
      </button>
    </form>
  );
}
