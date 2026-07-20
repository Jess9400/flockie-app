"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export type ActivityRequest = {
  requester_id: string;
  display_name: string | null;
  age: number | null;
  photo: string | null;
  level: string | null;
  note: string | null;
  status: string;
  score: number | null;
};

// Host-side request list under each posted activity: who wants in (with level,
// note, match %), Accept / Pass per person. Accept = match + chat + the
// activity landing as an accepted plan.
export default function ActivityRequests({
  activityId,
  requests,
}: {
  activityId: string;
  requests: ActivityRequest[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("activities.requests");
  const [items, setItems] = useState(requests);
  const [chatIds, setChatIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(userId: string, accept: boolean) {
    if (busy) return;
    setBusy(userId);
    const { data, error } = await supabase.rpc("respond_activity_request", {
      p_activity: activityId,
      p_user: userId,
      p_accept: accept,
    });
    setBusy(null);
    if (error) return;
    if (accept) {
      const chatId = (data as { chat_id?: string } | null)?.chat_id;
      if (chatId) setChatIds((cur) => ({ ...cur, [userId]: chatId }));
      setItems((cur) =>
        cur.map((r) => (r.requester_id === userId ? { ...r, status: "accepted" } : r))
      );
    } else {
      setItems((cur) => cur.filter((r) => r.requester_id !== userId));
    }
    router.refresh();
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl bg-cream/70 p-3">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink/50">
        {t("heading", { count: items.filter((r) => r.status === "pending").length })}
      </p>
      <div className="mt-2 space-y-2">
        {items.map((r) => (
          <div key={r.requester_id} className="rounded-xl border border-ink/10 bg-white p-2.5">
            <div className="flex items-center gap-2.5">
              <Link href={`/people/${r.requester_id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                {r.photo ? (
                  <Image src={r.photo} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                    {(r.display_name ?? "?")[0]?.toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-ink">
                    {r.display_name}
                    {r.age ? `, ${r.age}` : ""}
                  </span>
                  <span className="block truncate text-[11px] font-medium text-muted">
                    {[
                      r.score != null ? `${Math.round(r.score)}%` : null,
                      r.level ? t("level", { level: r.level }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
              {r.status === "accepted" ? (
                <Link
                  href={chatIds[r.requester_id] ? `/buddies/${chatIds[r.requester_id]}` : "/chats"}
                  className="shrink-0 rounded-full bg-onboarding-green px-3 py-1.5 text-xs font-bold text-white"
                >
                  {t("openChat")}
                </Link>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={busy === r.requester_id}
                    onClick={() => respond(r.requester_id, true)}
                    className="rounded-full bg-flockie-coral px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {t("accept")}
                  </button>
                  <button
                    type="button"
                    disabled={busy === r.requester_id}
                    onClick={() => respond(r.requester_id, false)}
                    className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
                  >
                    {t("decline")}
                  </button>
                </div>
              )}
            </div>
            {r.status === "pending" && r.note && (
              <p className="mt-1.5 line-clamp-2 pl-[42px] text-xs font-medium italic text-muted">“{r.note}”</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
