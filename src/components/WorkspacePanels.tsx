"use client";

import { useState } from "react";
import { CheckSquare, CalendarDays, Wallet, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import TripWorkspace from "@/components/TripWorkspace";
import ClubGatherings from "@/components/ClubGatherings";

type Member = { id: string; name: string; photo: string | null };
type Tab = "checklist" | "agenda" | "costs" | "deals";

// Compact planning strip that sits under the chat header. Each icon toggles a
// single inline panel (click again to hide) — one open at a time. Trips/flocks
// get the full set; clubs get calendar + to-dos + activity deals (no costs).
export default function WorkspacePanels({
  tripId,
  chatId,
  city,
  checkIn,
  checkOut,
  members,
  meId,
  spaceKind = "trip",
}: {
  tripId: string;
  chatId?: string; // the chat to post workspace events into (defaults to tripId)
  city: string;
  checkIn: string | null;
  checkOut: string | null;
  members: Member[];
  meId: string;
  spaceKind?: "trip" | "club";
}) {
  const t = useTranslations("trips.workspace");
  const supabase = createClient();
  const isClub = spaceKind === "club";
  const [open, setOpen] = useState<Tab | null>(null);
  const meName = (members.find((m) => m.id === meId)?.name ?? "").split(" ")[0] || "Someone";

  // Post a system line into the chat when the workspace changes.
  async function announce(text: string) {
    await supabase.rpc("post_workspace_event", {
      p_kind: isClub ? "club" : "buddy",
      p_id: chatId ?? tripId,
      p_text: text,
    });
  }

  // Soft, colour-coded chips — small and round when idle, gently tinted with a
  // ring and label when active. Cute, not bulky.
  const COLORS: Record<string, { on: string; off: string }> = {
    green: { on: "bg-onboarding-green/15 text-onboarding-green ring-2 ring-onboarding-green/35", off: "bg-onboarding-green/10 text-onboarding-green" },
    blue: { on: "bg-flockie-blue/15 text-flockie-blue ring-2 ring-flockie-blue/35", off: "bg-flockie-blue/10 text-flockie-blue" },
    orange: { on: "bg-flockie-orange/15 text-flockie-orange ring-2 ring-flockie-orange/35", off: "bg-flockie-orange/10 text-flockie-orange" },
    coral: { on: "bg-flockie-coral/15 text-flockie-coral ring-2 ring-flockie-coral/35", off: "bg-flockie-coral/10 text-flockie-coral" },
  };

  // For a club the "agenda" panel IS the meetup calendar, and the label says so.
  const tools: { key: Tab; Icon: typeof CheckSquare; label: string; color: string }[] = isClub
    ? [
        { key: "agenda", Icon: CalendarDays, label: t("tab.calendar"), color: "blue" },
        { key: "checklist", Icon: CheckSquare, label: t("tab.checklist"), color: "green" },
        { key: "deals", Icon: Ticket, label: t("tab.deals"), color: "coral" },
      ]
    : [
        { key: "checklist", Icon: CheckSquare, label: t("tab.checklist"), color: "green" },
        { key: "agenda", Icon: CalendarDays, label: t("tab.agenda"), color: "blue" },
        { key: "costs", Icon: Wallet, label: t("tab.costs"), color: "orange" },
        { key: "deals", Icon: Ticket, label: t("tab.deals"), color: "coral" },
      ];

  return (
    <div className="shrink-0 border-b border-ink/10 bg-white/70">
      <div className="flex items-center gap-1.5 px-3 py-2">
        {tools.map(({ key, Icon, label, color }) => {
          const active = open === key;
          const c = COLORS[color];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpen((cur) => (cur === key ? null : key))}
              aria-pressed={active}
              title={label}
              className={`flex h-8 items-center justify-center rounded-full text-xs font-bold transition-all active:scale-90 ${
                active ? `gap-1.5 px-3 ${c.on}` : `w-8 ${c.off}`
              }`}
            >
              <Icon size={15} strokeWidth={2.25} />
              {active && <span>{label}</span>}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="max-h-[46vh] overflow-y-auto border-t border-ink/10 bg-cream px-3 py-3">
          {isClub && open === "agenda" ? (
            // The club Calendar = its scheduled gatherings, not a free-form agenda.
            <ClubGatherings clubId={tripId} meId={meId} meName={meName} announce={announce} />
          ) : (
            <TripWorkspace
              tripId={tripId}
              city={city}
              checkIn={checkIn}
              checkOut={checkOut}
              members={members}
              meId={meId}
              spaceKind={spaceKind}
              only={open}
              dealsScope={isClub ? "activities" : "all"}
              announce={announce}
              embedded
            />
          )}
        </div>
      )}
    </div>
  );
}
