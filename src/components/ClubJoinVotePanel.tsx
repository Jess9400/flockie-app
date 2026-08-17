"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type JoinCandidate = {
  user_id: string;
  display_name: string | null;
  photo: string | null;
  message: string | null;
  yes_votes: number;
  no_votes: number;
  my_vote: boolean | null;
  electorate: number;
};

// Democratic entry: every active member votes YES/NO on applicants. The
// decision lands automatically at majority of the electorate
// (supabase/club-democratic-entry.sql); host/moderator manual decisions
// remain as the override.
export default function ClubJoinVotePanel({
  clubId,
  candidates,
}: {
  clubId: string;
  candidates: JoinCandidate[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.voting");
  const [rows, setRows] = useState(candidates);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (rows.length === 0) return null;

  async function vote(candidateId: string, value: boolean) {
    setBusy(candidateId);
    setErr(null);
    const { data, error } = await supabase.rpc("vote_club_member", {
      p_club: clubId,
      p_candidate: candidateId,
      p_vote: value,
    });
    setBusy(null);
    if (error) return setErr(error.message);
    const result = data as { yes: number; no: number; electorate: number; decision: string };
    if (result.decision !== "open") {
      setRows((prev) => prev.filter((c) => c.user_id !== candidateId));
      router.refresh();
      return;
    }
    setRows((prev) =>
      prev.map((c) =>
        c.user_id === candidateId
          ? { ...c, yes_votes: result.yes, no_votes: result.no, electorate: result.electorate, my_vote: value }
          : c
      )
    );
  }

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
      <h2 className="text-lg font-black text-ink">🗳️ {t("title")}</h2>
      <p className="mt-0.5 text-sm font-medium text-muted">{t("subtitle")}</p>

      <div className="mt-3 space-y-3">
        {rows.map((candidate) => (
          <div key={candidate.user_id} className="rounded-2xl bg-cream p-3">
            <div className="flex items-center gap-2">
              {candidate.photo ? (
                <Image src={candidate.photo} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                  {(candidate.display_name || "F")[0]}
                </span>
              )}
              <p className="min-w-0 truncate text-sm font-extrabold text-ink">
                {candidate.display_name || t("candidateFallback")}
              </p>
            </div>
            {candidate.message && (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-2.5 text-sm font-medium text-ink">
                “{candidate.message}”
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-muted">
                {t("tally", {
                  yes: candidate.yes_votes,
                  no: candidate.no_votes,
                  needed: Math.floor(candidate.electorate / 2) + 1,
                })}
              </p>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => vote(candidate.user_id, true)}
                  disabled={busy === candidate.user_id}
                  className={`rounded-full border border-ink/15 px-4 py-1.5 text-xs font-bold disabled:opacity-50 ${
                    candidate.my_vote === true ? "bg-[#06D6A0] text-white" : "bg-white text-ink"
                  }`}
                >
                  {t("yes")}
                </button>
                <button
                  type="button"
                  onClick={() => vote(candidate.user_id, false)}
                  disabled={busy === candidate.user_id}
                  className={`rounded-full border border-ink/15 px-4 py-1.5 text-xs font-bold disabled:opacity-50 ${
                    candidate.my_vote === false ? "bg-flockie-coral text-white" : "bg-white text-ink"
                  }`}
                >
                  {t("no")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {err && <p className="mt-2 text-sm font-bold text-flockie-coral">{err}</p>}
    </section>
  );
}
