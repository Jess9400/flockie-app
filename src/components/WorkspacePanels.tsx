"use client";

import { useState } from "react";
import { CheckSquare, CalendarDays, Wallet, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import TripWorkspace from "@/components/TripWorkspace";
import ClubGatherings from "@/components/ClubGatherings";

type Member = { id: string; name: string; photo: string | null };
type Tab = "checklist" | "agenda" | "costs" | "deals";

// Compact planning strip that sits under the chat header. Each icon toggles a
// single inline panel (click again to hide) — one open at a time. Trips/flocks
// get the full set; clubs get calendar + to-dos + activity deals (no costs).
export default function WorkspacePanels({
  tripId,
  city,
  checkIn,
  checkOut,
  members,
  meId,
  spaceKind = "trip",
}: {
  tripId: string;
  city: string;
  checkIn: string | null;
  checkOut: string | null;
  members: Member[];
  meId: string;
  spaceKind?: "trip" | "club";
}) {
  const t = useTranslations("trips.workspace");
  const isClub = spaceKind === "club";
  const [open, setOpen] = useState<Tab | null>(null);

  // Each tool has its own colour so the strip pops and reads at a glance.
  const COLORS: Record<string, { on: string; off: string }> = {
    green: { on: "border-onboarding-green bg-onboarding-green text-white", off: "border-onboarding-green/25 bg-onboarding-green/10 text-onboarding-green" },
    blue: { on: "border-flockie-blue bg-flockie-blue text-white", off: "border-flockie-blue/25 bg-flockie-blue/10 text-flockie-blue" },
    orange: { on: "border-flockie-orange bg-flockie-orange text-white", off: "border-flockie-orange/25 bg-flockie-orange/10 text-flockie-orange" },
    coral: { on: "border-flockie-coral bg-flockie-coral text-white", off: "border-flockie-coral/25 bg-flockie-coral/10 text-flockie-coral" },
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
    <div className="shrink-0 border-b border-ink/10 bg-white shadow-[0_1px_6px_rgba(10,37,69,0.05)]">
      <div className="flex items-center gap-2 px-3 py-2.5">
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
              className={`flex items-center gap-2 rounded-2xl border-2 px-3.5 py-2 text-[13px] font-extrabold transition-all active:scale-95 ${
                active ? `${c.on} shadow-[0_2px_8px_rgba(10,37,69,0.15)]` : c.off
              }`}
            >
              <Icon size={18} strokeWidth={2.5} />
              <span className={active ? "inline" : "hidden sm:inline"}>{label}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="max-h-[46vh] overflow-y-auto border-t border-ink/10 bg-cream px-3 py-3">
          {isClub && open === "agenda" ? (
            // The club Calendar = its scheduled gatherings, not a free-form agenda.
            <ClubGatherings clubId={tripId} meId={meId} />
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
              embedded
            />
          )}
        </div>
      )}
    </div>
  );
}
