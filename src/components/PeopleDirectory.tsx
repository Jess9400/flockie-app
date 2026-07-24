"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import FollowButton from "@/components/FollowButton";

type Person = {
  id: string;
  display_name: string | null;
  age: number | null;
  photo: string | null;
  one_liner?: string | null;
  city: string | null;
  met?: boolean;
  following: boolean;
};

type Tab = "find" | "following" | "followers";

// Find people + your follow lists. "People you've met" (matches, shared vibes,
// clubs) rank first — the graph starts in real rooms.
export default function PeopleDirectory({
  meId,
  initialTab,
  initialFind,
}: {
  meId: string;
  initialTab: Tab;
  initialFind: Person[];
}) {
  const supabase = createClient();
  const t = useTranslations("feed.people");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");
  const [find, setFind] = useState<Person[]>(initialFind);
  const [lists, setLists] = useState<Record<string, Person[]>>({});
  const [loading, setLoading] = useState(false);

  // Search (debounced) — Find tab only.
  useEffect(() => {
    if (tab !== "find") return;
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc("people_directory", { p_q: q.trim() || null, p_limit: 30 });
      setFind((data ?? []) as Person[]);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab]);

  // Follow lists — loaded once per tab visit.
  useEffect(() => {
    if (tab === "find" || lists[tab]) return;
    setLoading(true);
    supabase
      .rpc("follow_list", { p_user: meId, p_direction: tab })
      .then(({ data }) => {
        setLists((cur) => ({ ...cur, [tab]: (data ?? []) as Person[] }));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function row(p: Person) {
    const name = p.display_name ?? "Flockie";
    return (
      <div
        key={p.id}
        className="flex items-center gap-3 rounded-2xl border border-ink/15 bg-white p-3 shadow-[0_2px_10px_rgba(10,37,69,0.06)]"
      >
        <Link href={`/people/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          {p.photo ? (
            <Image src={p.photo} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flockie-blue text-sm font-bold text-white">
              {name[0]?.toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-extrabold text-ink">
                {name}
                {p.age ? `, ${p.age}` : ""}
              </span>
              {p.met && (
                <span className="shrink-0 rounded-full bg-onboarding-green/10 px-2 py-0.5 text-[10px] font-extrabold text-onboarding-green">
                  🤝 {t("metBadge")}
                </span>
              )}
            </span>
            <span className="block truncate text-xs font-medium text-muted">
              {p.one_liner || p.city || ""}
            </span>
          </span>
        </Link>
        <FollowButton userId={p.id} initialFollowing={p.following} compact />
      </div>
    );
  }

  const met = find.filter((p) => p.met);
  const rest = find.filter((p) => !p.met);
  const activeList = tab === "find" ? null : lists[tab];

  return (
    <div>
      <div className="flex gap-2">
        {(["find", "following", "followers"] as Tab[]).map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={`rounded-full border px-4 py-1.5 text-sm font-bold ${
              tab === tb ? "border-flockie-coral bg-flockie-coral text-white" : "border-ink/15 bg-white text-ink/55 hover:text-ink"
            }`}
          >
            {t(`tab.${tb}`)}
          </button>
        ))}
      </div>

      {tab === "find" ? (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-full border border-ink/15 bg-white py-2 pl-4 pr-3 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
            <Search size={17} className="shrink-0 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted"
            />
          </div>
          {met.length > 0 && (
            <>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-wide text-muted">{t("metHeading")}</p>
              <div className="mt-2 space-y-2">{met.map(row)}</div>
            </>
          )}
          {rest.length > 0 && (
            <>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-wide text-muted">{t("cityHeading")}</p>
              <div className="mt-2 space-y-2">{rest.map(row)}</div>
            </>
          )}
          {find.length === 0 && (
            <p className="mt-8 text-center text-sm font-medium text-muted">{t("emptyFind")}</p>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-2">
          {loading && !activeList ? (
            <p className="py-8 text-center text-sm font-medium text-muted">…</p>
          ) : (activeList ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-muted">
              {tab === "following" ? t("emptyFollowing") : t("emptyFollowers")}
            </p>
          ) : (
            (activeList ?? []).map(row)
          )}
        </div>
      )}
    </div>
  );
}
