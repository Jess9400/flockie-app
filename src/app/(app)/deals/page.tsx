import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import DealsSearch, { type Plan } from "@/components/DealsSearch";
import PageTabs from "@/components/PageTabs";

export default async function DealsPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("deals");

  const TRIP_TABS = [
    { href: "/my-activities", label: t("tabMyActivities") },
    { href: "/deals", label: t("tabDeals") },
    { href: "/my-trips", label: t("tabMyTrips"), soon: true },
  ];

  const [{ data: profile }, { data: trips }] = await Promise.all([
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
  ]);

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
        <DealsSearch defaultCity={profile?.home_city ?? ""} plans={plans} />
      </div>
    </main>
  );
}
