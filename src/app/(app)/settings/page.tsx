import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import NotificationsToggle from "@/components/NotificationsToggle";
import LocationToggle from "@/components/LocationToggle";
import SignOutButton from "@/components/SignOutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("notifications_enabled")
    .eq("id", user!.id)
    .maybeSingle();

  // Separate (migration-safe) query — column added by location-tracking.sql.
  const { data: loc } = await supabase
    .from("profiles")
    .select("location_tracking_enabled")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pb-24 pt-6 font-nunito">
      <Link
        href="/profile"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-navy/60 hover:text-navy"
      >
        <ChevronLeft size={16} /> Profile
      </Link>

      <h1 className="font-fredoka text-3xl font-bold text-navy">Settings</h1>

      <section className="mt-8 space-y-3">
        <NotificationsToggle
          userId={user!.id}
          initial={profile?.notifications_enabled ?? true}
        />
        <LocationToggle
          userId={user!.id}
          initial={loc?.location_tracking_enabled ?? false}
        />
      </section>

      <section className="mt-8">
        <h2 className="font-fredoka text-lg font-semibold text-navy">Account</h2>
        <p className="mt-1 text-sm font-medium text-navy/60">{user?.email}</p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </section>

      <section className="mt-12">
        <DeleteAccountButton />
      </section>
    </main>
  );
}
