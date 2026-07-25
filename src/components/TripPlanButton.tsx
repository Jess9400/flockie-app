"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Compass, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEsc } from "@/lib/use-esc";
import TripWorkspace from "@/components/TripWorkspace";

type Member = { id: string; name: string; photo: string | null };

// In the flock/trip chat: a header pill that opens the planning workspace as a
// full-screen overlay, so the group plans while they talk without the chat
// losing its fixed-height layout.
export default function TripPlanButton({
  tripId,
  city,
  checkIn,
  checkOut,
  members,
  meId,
}: {
  tripId: string;
  city: string;
  checkIn: string | null;
  checkOut: string | null;
  members: Member[];
  meId: string;
}) {
  const t = useTranslations("trips.workspace");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  useEsc(() => setOpen(false), open);

  return (
    <div className="shrink-0 px-1 pb-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-full border border-flockie-orange/40 bg-flockie-orange/5 py-2 text-sm font-bold text-flockie-orange"
      >
        <Compass size={15} /> {t("openCta")}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={() => setOpen(false)}>
            <div
              className="mt-auto max-h-[92vh] overflow-y-auto rounded-t-3xl bg-cream p-4 sm:mx-auto sm:my-auto sm:max-w-2xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-fredoka text-lg font-black text-ink">🧭 {t("heading")}</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="rounded-full p-1 text-ink/50 hover:bg-white hover:text-ink">
                  <X size={20} />
                </button>
              </div>
              <TripWorkspace tripId={tripId} city={city} checkIn={checkIn} checkOut={checkOut} members={members} meId={meId} embedded />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
