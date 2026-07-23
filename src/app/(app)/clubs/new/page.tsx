import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import CreateFormingClub from "@/components/CreateFormingClub";

export default async function NewClubPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("clubs.create");
  const { data: profile } = await supabase
    .from("profiles")
    .select("home_city")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <Link
        href="/clubs"
        className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> {t("back")}
      </Link>
      <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-flockie-coral">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">{t("title")}</h1>
      <p className="mt-2 max-w-xl text-base font-medium leading-relaxed text-muted">{t("intro")}</p>
      <CreateFormingClub defaultCity={profile?.home_city ?? ""} userId={user!.id} />
    </main>
  );
}
