import { createClient } from "@/lib/supabase/server";
import DealsSearch, { type Plan } from "@/components/DealsSearch";
import PageTabs from "@/components/PageTabs";

const TRIP_TABS = [
  { href: "/my-trips", label: "My Trips" },
  { href: "/my-activities", label: "My Activities" },
  { href: "/deals", label: "Deals" },
];

export default async function DealsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const plans: Plan[] = (trips ?? []).map((t) => {
    const dests = ((t.destinations as string[] | null) ?? [t.destination]).filter(Boolean) as string[];
    return {
      id: t.id as string,
      label: dests.join(" · ") || "Trip",
      city: dests[0] ?? "",
      checkIn: (t.start_date as string) ?? "",
      checkOut: (t.end_date as string) ?? "",
      guests: (t.group_size as number) ?? 2,
    };
  });

  return (
    <main className="px-5 pt-6">
      <PageTabs tabs={TRIP_TABS} />
      <h1 className="text-2xl font-black">Deals</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Best travel deals for your trips — or anywhere.
      </p>
      <div className="mt-6">
        <DealsSearch defaultCity={profile?.home_city ?? ""} plans={plans} />
      </div>
    </main>
  );
}
