import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import { formatVibeWhen } from "@/lib/vibes";
import DealsSearch, { type Plan, type VibePlan } from "@/components/DealsSearch";
import PageTabs from "@/components/PageTabs";

export default async function DealsPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("deals");
  const locale = await getLocale();

  const TRIP_TABS = [
    { href: "/my-activities", label: t("tabMyActivities") },
    { href: "/deals", label: t("tabDeals") },
    { href: "/my-trips", label: t("tabMyTrips"), soon: true },
  ];

  const nowIso = new Date().toISOString();

  const [{ data: profile }, { data: trips }, { data: myConfirmed }] = await Promise.all([
    supabase.from("profiles").select("home_city").eq("id", user!.id).maybeSingle(),
    // Upcoming trips/flocks the user is organising — the destinations they'll
    // actually book stays / flights / activities for.
    supabase
      .from("trips")
      .select("id, destination, destinations, start_date, end_date, group_size, kind")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .neq("kind", "activity")
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .order("start_date", { ascending: true })
      .limit(8),
    // Vibes the user is confirmed for — real upcoming plans to shop for.
    supabase
      .from("vibe_interests")
      .select("vibe_id")
      .eq("user_id", user!.id)
      .eq("status", "confirmed"),
  ]);

  // Deals context for confirmed upcoming Vibes (next 3).
  let vibePlans: VibePlan[] = [];
  const confirmedIds = (myConfirmed ?? []).map((r) => r.vibe_id as string);
  if (confirmedIds.length) {
    const { data: pv } = await supabase
      .from("vibe_directory")
      .select("id, title, starts_at, city, timezone, status")
      .in("id", confirmedIds)
      .gt("starts_at", nowIso)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(3);
    vibePlans = ((pv ?? []) as { id: string; title: string; starts_at: string; city: string; timezone: string | null }[]).map(
      (v) => ({
        id: v.id,
        title: v.title,
        city: v.city,
        when: formatVibeWhen(v.starts_at, locale, v.timezone),
      })
    );
  }

  const plans: Plan[] = (trips ?? []).map((trip) => {
    const dests = ((trip.destinations as string[] | null) ?? [trip.destination]).filter(Boolean) as string[];
    return {
      id: trip.id as string,
      label: dests.join(" · ") || t("tripFallback"),
      city: dests[0] ?? "",
      checkIn: (trip.start_date as string) ?? "",
      checkOut: (trip.end_date as string) ?? "",
      guests: (trip.group_size as number) ?? 2,
    };
  });

  return (
    <main className="px-5 pt-6">
      <PageTabs tabs={TRIP_TABS} />
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        {t("subtitle")}
      </p>
      <div className="mt-6">
        <DealsSearch defaultCity={profile?.home_city ?? ""} plans={plans} vibePlans={vibePlans} />
      </div>
    </main>
  );
}
