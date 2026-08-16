"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type RosterMember = {
  id: string;
  display_name: string | null;
  photo: string | null;
  role: string;
};

// Host-only panel: promote active members to moderator (they can approve
// membership requests and record attendance) or demote them back. The host
// role itself never changes here - see supabase/club-moderators.sql.
export default function ClubModeratorsPanel({
  clubId,
  members,
}: {
  clubId: string;
  members: RosterMember[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.moderators");
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(members.map((member) => [member.id, member.role]))
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function setRole(userId: string, role: "member" | "moderator") {
    setBusyId(userId);
    setErr(null);
    const { error } = await supabase.rpc("set_club_member_role", {
      p_club: clubId,
      p_user: userId,
      p_role: role,
    });
    setBusyId(null);
    if (error) return setErr(error.message);
    setRoles((prev) => ({ ...prev, [userId]: role }));
    router.refresh();
  }

  return (
    <section className="mt-5 rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
      <h2 className="text-lg font-black text-ink">🛡️ {t("title")}</h2>
      <p className="mt-0.5 text-sm font-medium text-muted">{t("subtitle")}</p>

      {members.length === 0 && (
        <p className="mt-3 rounded-2xl bg-cream p-3 text-sm font-medium text-muted">
          {t("empty")}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {members.map((member) => {
          const isModerator = roles[member.id] === "moderator";
          return (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {member.photo ? (
                  <Image
                    src={member.photo}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                    {(member.display_name || "F")[0]}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">
                    {member.display_name || t("memberFallback")}
                  </p>
                  {isModerator && (
                    <p className="text-[11px] font-bold text-flockie-blue">{t("moderatorBadge")}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRole(member.id, isModerator ? "member" : "moderator")}
                disabled={busyId === member.id}
                className={`shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                  isModerator ? "bg-white text-ink" : "bg-flockie-blue text-white"
                }`}
              >
                {isModerator ? t("demote") : t("promote")}
              </button>
            </div>
          );
        })}
      </div>
      {err && <p className="mt-2 text-sm font-bold text-flockie-coral">{err}</p>}
    </section>
  );
}
