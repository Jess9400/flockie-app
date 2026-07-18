"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEsc } from "@/lib/use-esc";

// Categories mirror buddy_plans' allow-list so the invite seeds a plan cleanly.
const CATS = [
  { key: "coffee", emoji: "☕", search: "coffee shops" },
  { key: "restaurant", emoji: "🍽️", search: "restaurants" },
  { key: "bar", emoji: "🍸", search: "bars" },
  { key: "park", emoji: "🌳", search: "parks" },
  { key: "activity", emoji: "🎾", search: "things to do" },
] as const;
type CatKey = (typeof CATS)[number]["key"];

function mapsSearch(query: string, city: string | null) {
  const q = city ? `${query} in ${city}` : query;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// "Say hi" by proposing a concrete plan: a category, optionally a place (found
// via a Google Maps browse link) and a date/time. This records a like carrying
// the plan; when the person matches back, a buddy_plans row is auto-seeded so
// they open the chat to "X invited you for coffee at [place], [date] — Accept".
export default function SayHiButton({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const supabase = createClient();
  const t = useTranslations("match.sayHi");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState<CatKey | null>(null);
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull the person's city once open, so the Maps browse link is local to them.
  useEffect(() => {
    if (!open || city !== null) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("home_city")
      .eq("id", personId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setCity(data?.home_city ?? "");
      });
    return () => {
      alive = false;
    };
  }, [open, personId, city, supabase]);

  const catMeta = CATS.find((c) => c.key === cat) ?? null;

  async function send() {
    if (!cat || busy) return;
    setBusy(true);
    setError(null);
    const label = t(`cat.${cat}`);
    const trimmedPlace = place.trim();
    const whenIso = when ? new Date(when).toISOString() : null;
    const { error } = await supabase.rpc("buddy_swipe", {
      p_target: personId,
      p_liked: true,
      p_activity_title: label,
      p_category: cat,
      p_place_name: trimmedPlace || null,
      p_place_url:
        trimmedPlace && catMeta ? mapsSearch(trimmedPlace, city || null) : null,
      p_when: whenIso,
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("blocked_by_preferences")
          ? t("errBlocked")
          : error.message
      );
      return;
    }
    // Human summary for the confirmation screen.
    const parts = [label.toLowerCase()];
    if (trimmedPlace) parts.push(`at ${trimmedPlace}`);
    if (whenIso)
      parts.push(
        `· ${new Date(whenIso).toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        })}`
      );
    setSent(parts.join(" "));
  }

  function close() {
    setOpen(false);
    setSent(null);
    setCat(null);
    setPlace("");
    setWhen("");
    setError(null);
  }

  useEsc(() => !busy && close(), open);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-full border border-ink/15 bg-flockie-coral py-1.5 text-xs font-bold text-white transition-transform active:scale-95"
      >
        {t("button")}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !busy && close()}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("inviteAria", { name: personName })}
              className="w-full max-w-sm rounded-3xl border-2 border-ink/15 bg-white p-6 shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
              onClick={(e) => e.stopPropagation()}
            >
              {sent ? (
                <div className="text-center">
                  <p className="text-4xl">📨</p>
                  <h2 className="mt-2 text-xl font-extrabold text-ink">
                    {t("sentTitle", { name: personName })}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-muted">
                    {t.rich("sentBody", {
                      activity: sent,
                      b: (chunks) => <span className="font-bold">{chunks}</span>,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="mt-4 w-full rounded-full border border-ink/15 bg-flockie-blue py-2.5 text-sm font-bold text-white"
                  >
                    {t("done")}
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-center text-xl font-extrabold text-ink">
                    {t("inviteToTitle", { name: personName })}
                  </h2>
                  <p className="mt-1 text-center text-sm font-medium text-muted">
                    {t("pickSomething")}
                  </p>

                  {/* Step 1 — category */}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {CATS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        disabled={busy}
                        onClick={() => setCat(c.key)}
                        className={`rounded-2xl border px-3 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                          cat === c.key
                            ? "border-flockie-coral bg-flockie-coral text-white"
                            : "border-ink/15 bg-cream text-ink hover:border-flockie-coral/50"
                        }`}
                      >
                        <span className="mr-1">{c.emoji}</span> {t(`cat.${c.key}`)}
                      </button>
                    ))}
                  </div>

                  {/* Step 2 — place + when (only once a category is picked) */}
                  {cat && catMeta && (
                    <div className="mt-4 space-y-3">
                      <a
                        href={mapsSearch(catMeta.search, city || null)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-full border border-flockie-blue/40 bg-flockie-blue/5 py-2 text-xs font-bold text-flockie-blue"
                      >
                        <MapPin size={14} />{" "}
                        {t("browseNear", { cat: t(`cat.${cat}`).toLowerCase() })}
                      </a>
                      <input
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        placeholder={t("placePlaceholder")}
                        maxLength={80}
                        className="h-11 w-full rounded-xl border border-ink/25 px-4 text-sm font-medium outline-none focus:border-flockie-blue"
                      />
                      <input
                        type="datetime-local"
                        value={when}
                        onChange={(e) => setWhen(e.target.value)}
                        className="h-11 w-full rounded-xl border border-ink/25 px-4 text-sm font-medium text-ink outline-none focus:border-flockie-blue"
                      />
                      <p className="text-center text-[11px] font-medium text-muted">
                        {t("optionalNote")}
                      </p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={send}
                        className="w-full rounded-full border border-ink/15 bg-flockie-coral py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {busy ? t("sending") : t("sendInvite")}
                      </button>
                    </div>
                  )}

                  {error && (
                    <p className="mt-2 text-center text-sm font-bold text-red-700">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="mt-3 block w-full text-center text-sm font-bold text-muted underline disabled:opacity-50"
                  >
                    {t("cancel")}
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
