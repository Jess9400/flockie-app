import { createClient } from "@/lib/supabase/server";
import DealsSearch from "@/components/DealsSearch";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("home_city")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <main className="px-5 pt-6">
      <PageTabs tabs={TRIP_TABS} />
      <h1 className="text-2xl font-black">Deals</h1>
      <p className="mt-1 text-sm font-medium text-muted">
        Best travel deals, in your city or anywhere.
      </p>
      <div className="mt-6">
        <DealsSearch defaultCity={profile?.home_city ?? ""} />
      </div>
    </main>
  );
}
