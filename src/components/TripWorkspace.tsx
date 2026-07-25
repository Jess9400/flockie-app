"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckSquare, CalendarDays, Wallet, Ticket, Plus, X, Hotel, Plane, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Tab = "checklist" | "agenda" | "costs" | "deals";
type Member = { id: string; name: string; photo: string | null };
type ChecklistItem = { id: string; title: string; assignee: string | null; done: boolean; done_by: string[] };
type AgendaItem = { id: string; day: string | null; title: string; note: string | null };
type Expense = { id: string; payer_id: string; title: string; amount: number; currency: string; split_with: string[] };
type Balance = { user_id: string; display_name: string | null; photo: string | null; net: number };

const MARKER = "544482";

// The shared planning HQ for a trip/flock: checklist, agenda, costs ledger
// (no payments), and Deals widgets. Member-gated by RLS on every table.
export default function TripWorkspace({
  tripId,
  city,
  checkIn,
  checkOut,
  members,
  meId,
  embedded = false,
  spaceKind = "trip",
  only,
  dealsScope = "all",
}: {
  tripId: string;
  city: string;
  checkIn: string | null;
  checkOut: string | null;
  members: Member[];
  meId: string;
  embedded?: boolean;
  spaceKind?: "trip" | "club";
  only?: Tab;
  dealsScope?: "all" | "activities";
}) {
  const supabase = createClient();
  const t = useTranslations("trips.workspace");
  const [tab, setTab] = useState<Tab>(only ?? "checklist");
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? "";
  // Workspace tables are shared by trips/flocks and clubs — same schema, keyed
  // by either trip_id or club_id.
  const keyCol = spaceKind === "club" ? "club_id" : "trip_id";

  function panel(which: Tab) {
    switch (which) {
      case "checklist": return <Checklist tripId={tripId} members={members} meId={meId} nameOf={nameOf} />;
      case "agenda": return <Agenda tripId={tripId} meId={meId} />;
      case "costs": return <Costs tripId={tripId} members={members} meId={meId} nameOf={nameOf} />;
      case "deals": return <Deals city={city} checkIn={checkIn} checkOut={checkOut} guests={members.length} scope={dealsScope} />;
    }
  }

  // Single-panel mode: the caller (WorkspacePanels) owns the icon toggles, so we
  // render just the requested panel with no tab bar or heading.
  if (only) return <div>{panel(only)}</div>;

  const Wrapper = embedded ? "div" : "section";
  return (
    <Wrapper className={embedded ? "" : "mt-6 rounded-3xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-5"}>
      {!embedded && <h2 className="text-lg font-black text-ink">🧭 {t("heading")}</h2>}
      <p className="text-xs font-medium text-muted">{t("sub")}</p>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {([
          ["checklist", CheckSquare],
          ["agenda", CalendarDays],
          ["costs", Wallet],
          ["deals", Ticket],
        ] as const).map(([key, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === key ? "border-flockie-coral bg-flockie-coral text-white" : "border-ink/15 bg-white text-ink/60 hover:text-ink"
            }`}
          >
            <Icon size={13} /> {t(`tab.${key}`)}
          </button>
        ))}
      </div>

      <div className="mt-4">{panel(tab)}</div>
    </Wrapper>
  );

  // ── Checklist (per-member completion) ───────────────────────────────────────
  function Checklist({ tripId, members, meId }: { tripId: string; members: Member[]; meId: string; nameOf: (id: string | null) => string }) {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      supabase
        .from("trip_checklist")
        .select("id, title, assignee, done, done_by")
        .eq(keyCol, tripId)
        .order("created_at")
        .then(({ data }) => {
          setItems((data ?? []).map((d) => ({ ...d, done_by: d.done_by ?? [] })) as ChecklistItem[]);
          setLoading(false);
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function add() {
      if (!title.trim()) return;
      const { data } = await supabase
        .from("trip_checklist")
        .insert({ [keyCol]: tripId, title: title.trim(), created_by: meId })
        .select("id, title, assignee, done, done_by")
        .single();
      if (data) setItems((c) => [...c, { ...data, done_by: [] } as ChecklistItem]);
      setTitle("");
    }
    // Toggle a member's done state on an item (small trusted group — anyone can
    // update, e.g. the organizer marking for someone).
    async function toggleMember(it: ChecklistItem, userId: string) {
      const next = it.done_by.includes(userId)
        ? it.done_by.filter((u) => u !== userId)
        : [...it.done_by, userId];
      setItems((c) => c.map((x) => (x.id === it.id ? { ...x, done_by: next } : x)));
      await supabase.from("trip_checklist").update({ done_by: next }).eq("id", it.id);
    }
    async function remove(id: string) {
      setItems((c) => c.filter((x) => x.id !== id));
      await supabase.from("trip_checklist").delete().eq("id", id);
    }

    return (
      <div>
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={t("checklistPlaceholder")}
            className="h-10 min-w-0 flex-1 rounded-xl border border-ink/25 px-3 text-sm font-medium outline-none focus:border-flockie-blue"
          />
          <button type="button" onClick={add} className="shrink-0 rounded-xl bg-flockie-coral px-3 text-white"><Plus size={16} /></button>
        </div>
        <p className="mt-1 text-[10px] font-medium text-muted">{t("checklistHint")}</p>
        {loading ? null : items.length === 0 ? (
          <p className="mt-4 text-center text-xs font-medium text-muted">{t("checklistEmpty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((it) => {
              const doneCount = members.filter((m) => it.done_by.includes(m.id)).length;
              const allDone = doneCount === members.length && members.length > 0;
              return (
                <li key={it.id} className="rounded-xl border border-ink/10 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`min-w-0 flex-1 text-sm font-bold ${allDone ? "text-onboarding-green" : "text-ink"}`}>{it.title}</span>
                    <span className="shrink-0 text-[11px] font-bold text-muted">{doneCount}/{members.length}</span>
                    <button type="button" onClick={() => remove(it.id)} className="shrink-0 text-ink/30 hover:text-ink"><X size={14} /></button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const done = it.done_by.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMember(it, m.id)}
                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors ${
                            done ? "border-onboarding-green bg-onboarding-green/10 text-onboarding-green" : "border-ink/15 bg-white text-ink/45"
                          }`}
                        >
                          <span>{done ? "✓" : "○"}</span>
                          {m.name.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── Agenda ──────────────────────────────────────────────────────────────────
  function Agenda({ tripId, meId }: { tripId: string; meId: string }) {
    const [items, setItems] = useState<AgendaItem[]>([]);
    const [day, setDay] = useState("");
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      supabase
        .from("trip_agenda")
        .select("id, day, title, note")
        .eq(keyCol, tripId)
        .order("day", { ascending: true, nullsFirst: false })
        .order("created_at")
        .then(({ data }) => {
          setItems((data ?? []) as AgendaItem[]);
          setLoading(false);
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [bulk, setBulk] = useState("");
    const [showBulk, setShowBulk] = useState(false);

    async function add() {
      if (!title.trim()) return;
      const { data } = await supabase
        .from("trip_agenda")
        .insert({ [keyCol]: tripId, day: day || null, title: title.trim(), created_by: meId })
        .select("id, day, title, note")
        .single();
      if (data) {
        setItems((c) => [...c, data as AgendaItem].sort((a, b) => (a.day ?? "9999").localeCompare(b.day ?? "9999")));
      }
      setTitle("");
    }
    // Paste a whole itinerary — one line per item; a leading date (2026-08-10 …)
    // is picked up as the day.
    async function importBulk() {
      const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 60);
      if (!lines.length) return;
      const rows = lines.map((line) => {
        const m = line.match(/^(\d{4}-\d{2}-\d{2})\s*[-:.]?\s*(.+)$/);
        return { [keyCol]: tripId, day: m ? m[1] : null, title: (m ? m[2] : line).slice(0, 200), created_by: meId };
      });
      const { data } = await supabase.from("trip_agenda").insert(rows).select("id, day, title, note");
      if (data) setItems((c) => [...c, ...(data as AgendaItem[])].sort((a, b) => (a.day ?? "9999").localeCompare(b.day ?? "9999")));
      setBulk("");
      setShowBulk(false);
    }
    async function remove(id: string) {
      setItems((c) => c.filter((x) => x.id !== id));
      await supabase.from("trip_agenda").delete().eq("id", id);
    }

    return (
      <div>
        <div className="flex gap-2">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-10 shrink-0 rounded-xl border border-ink/25 bg-white px-2 text-xs font-bold outline-none" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={t("agendaPlaceholder")}
            className="h-10 min-w-0 flex-1 rounded-xl border border-ink/25 px-3 text-sm font-medium outline-none focus:border-flockie-blue"
          />
          <button type="button" onClick={add} className="shrink-0 rounded-xl bg-flockie-coral px-3 text-white"><Plus size={16} /></button>
        </div>
        <button type="button" onClick={() => setShowBulk((v) => !v)} className="mt-1.5 text-[11px] font-bold text-flockie-blue">
          {showBulk ? t("pasteHide") : t("pasteShow")}
        </button>
        {showBulk && (
          <div className="mt-1.5">
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={4}
              placeholder={t("pastePlaceholder")}
              className="w-full resize-none rounded-xl border border-ink/25 px-3 py-2 text-xs font-medium outline-none focus:border-flockie-blue"
            />
            <button type="button" onClick={importBulk} className="mt-1 rounded-full bg-flockie-blue px-4 py-1.5 text-xs font-bold text-white">{t("pasteImport")}</button>
          </div>
        )}
        {loading ? null : items.length === 0 ? (
          <p className="mt-4 text-center text-xs font-medium text-muted">{t("agendaEmpty")}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2.5 rounded-xl border border-ink/10 px-3 py-2">
                {it.day && <span className="shrink-0 rounded-lg bg-flockie-blue/10 px-2 py-1 text-[10px] font-extrabold text-flockie-blue">{new Date(it.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{it.title}</span>
                <button type="button" onClick={() => remove(it.id)} className="shrink-0 text-ink/30 hover:text-ink"><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Costs ledger ─────────────────────────────────────────────────────────────
  function Costs({ tripId, members, meId, nameOf }: { tripId: string; members: Member[]; meId: string; nameOf: (id: string | null) => string }) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [balances, setBalances] = useState<Balance[]>([]);
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(true);

    async function load() {
      const [{ data: exp }, { data: bal }] = await Promise.all([
        supabase.from("trip_expenses").select("id, payer_id, title, amount, currency, split_with").eq(keyCol, tripId).order("created_at", { ascending: false }),
        supabase.rpc(spaceKind === "club" ? "club_balances" : "trip_balances", spaceKind === "club" ? { p_club: tripId } : { p_trip: tripId }),
      ]);
      setExpenses((exp ?? []) as Expense[]);
      setBalances((bal ?? []) as Balance[]);
      setLoading(false);
    }
    useEffect(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function add() {
      const amt = Number(amount);
      if (!title.trim() || !(amt > 0)) return;
      await supabase.from("trip_expenses").insert({ [keyCol]: tripId, payer_id: meId, title: title.trim(), amount: amt, currency: "USD", split_with: [] });
      setTitle("");
      setAmount("");
      load();
    }
    async function remove(id: string) {
      await supabase.from("trip_expenses").delete().eq("id", id);
      load();
    }

    return (
      <div>
        <div className="flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("costTitle")} className="h-10 min-w-0 flex-1 rounded-xl border border-ink/25 px-3 text-sm font-medium outline-none focus:border-flockie-blue" />
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0" className="h-10 w-20 shrink-0 rounded-xl border border-ink/25 px-3 text-sm font-bold outline-none" />
          <button type="button" onClick={add} className="shrink-0 rounded-xl bg-flockie-coral px-3 text-white"><Plus size={16} /></button>
        </div>
        <p className="mt-1 text-[10px] font-medium text-muted">{t("costNote")}</p>

        {!loading && balances.some((b) => Math.abs(b.net) > 0.005) && (
          <div className="mt-3 rounded-xl bg-cream p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink/50">{t("balances")}</p>
            <div className="mt-1.5 space-y-1">
              {balances.map((b) => (
                <div key={b.user_id} className="flex items-center justify-between text-xs font-bold">
                  <span className="text-ink">{b.display_name ?? "Flockie"}</span>
                  <span className={b.net >= 0 ? "text-onboarding-green" : "text-flockie-coral"}>
                    {b.net >= 0 ? t("getsBack", { amt: b.net.toFixed(2) }) : t("owes", { amt: Math.abs(b.net).toFixed(2) })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? null : expenses.length === 0 ? (
          <p className="mt-4 text-center text-xs font-medium text-muted">{t("costsEmpty")}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 rounded-xl border border-ink/10 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{e.title}</span>
                  <span className="text-[11px] font-medium text-muted">{t("paidBy", { name: nameOf(e.payer_id) })}</span>
                </span>
                <span className="shrink-0 text-sm font-extrabold text-ink">{e.currency} {e.amount.toFixed(2)}</span>
                {e.payer_id === meId && <button type="button" onClick={() => remove(e.id)} className="shrink-0 text-ink/30 hover:text-ink"><X size={14} /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Deals widgets ─────────────────────────────────────────────────────────────
  function Deals({ city, checkIn, checkOut, guests, scope = "all" }: { city: string; checkIn: string | null; checkOut: string | null; guests: number; scope?: "all" | "activities" }) {
    const stays = (() => {
      const p = new URLSearchParams({ marker: MARKER, destination: city, adults: String(Math.max(1, guests)), locale: "en", currency: "usd" });
      if (checkIn) p.set("checkIn", checkIn);
      if (checkOut) p.set("checkOut", checkOut);
      return `https://search.hotellook.com/?${p}`;
    })();
    const klook = city ? `https://www.klook.com/search/?query=${encodeURIComponent(city)}` : "https://www.klook.com/";
    // Clubs only book activities (no hotels/flights/cars — they meet locally).
    const rows: [typeof Hotel, string, string][] = scope === "activities"
      ? [[Ticket, t("dealActivities"), klook]]
      : [
          [Hotel, t("dealStays"), stays],
          [Ticket, t("dealActivities"), klook],
          [Plane, t("dealFlights"), `https://www.aviasales.com/?marker=${MARKER}&locale=en`],
          [Car, t("dealCars"), "https://economybookings.tpo.li/JdOiCIeg"],
        ];
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted">{t("dealsIntro", { city: city || t("yourCity") })}</p>
        {rows.map(([Icon, label, href], i) => (
          <a key={i} href={href} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-2xl border border-ink/15 bg-white p-3 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-flockie-orange/10 text-flockie-orange"><Icon size={17} /></span>
            <span className="flex-1">{label}</span>
            <span className="text-xs font-bold text-flockie-blue">{t("book")} →</span>
          </a>
        ))}
        <p className="text-center text-[10px] font-medium text-muted">{t("affiliate")}</p>
      </div>
    );
  }
}
