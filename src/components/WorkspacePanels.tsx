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

  // For a club the "agenda" panel IS the meetup calendar, and the label says so.
  const tools: { key: Tab; Icon: typeof CheckSquare; label: string }[] = isClub
    ? [
        { key: "agenda", Icon: CalendarDays, label: t("tab.calendar") },
        { key: "checklist", Icon: CheckSquare, label: t("tab.checklist") },
        { key: "deals", Icon: Ticket, label: t("tab.deals") },
      ]
    : [
        { key: "checklist", Icon: CheckSquare, label: t("tab.checklist") },
        { key: "agenda", Icon: CalendarDays, label: t("tab.agenda") },
        { key: "costs", Icon: Wallet, label: t("tab.costs") },
        { key: "deals", Icon: Ticket, label: t("tab.deals") },
      ];

  return (
    <div className="shrink-0 border-b border-ink/10">
      <div className="flex items-center gap-1 px-2 py-1.5">
        {tools.map(({ key, Icon, label }) => {
          const active = open === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpen((cur) => (cur === key ? null : key))}
              aria-pressed={active}
              title={label}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${
                active
                  ? "border-flockie-coral bg-flockie-coral text-white"
                  : "border-ink/12 bg-white text-ink/55 hover:text-ink"
              }`}
            >
              <Icon size={14} />
              <span className={active ? "inline" : "hidden sm:inline"}>{label}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="max-h-[46vh] overflow-y-auto border-t border-ink/10 bg-cream px-3 py-3">
          {isClub && open === "agenda" ? (
            // The club Calendar = its scheduled gatherings, not a free-form agenda.
            <ClubGatherings clubId={tripId} />
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
