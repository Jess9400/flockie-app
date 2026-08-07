import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import PeopleDirectory from "@/components/PeopleDirectory";

// Find people + Following/Followers lists. Met-in-person ranks first.
export default async function PeoplePage(
  props: {
    searchParams: Promise<{ tab?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const user = await getSessionUser();
  const t = await getTranslations("feed.people");

  const tab =
    searchParams.tab === "following" || searchParams.tab === "followers"
      ? searchParams.tab
      : "find";

  // Migration-safe: before follows.sql runs, render an empty directory.
  const { data, error } = await supabase.rpc("people_directory", { p_q: null, p_limit: 30 });

  return (
    <main className="mx-auto max-w-xl px-5 pb-10 pt-6">
      <Link href="/profile" className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink">
        <ArrowLeft size={15} /> {t("back")}
      </Link>
      <h1 className="text-2xl font-black">{t("heading")}</h1>
      <p className="mt-1 text-sm font-medium text-muted">{t("subtitle")}</p>
      <div className="mt-5">
        <PeopleDirectory meId={user!.id} initialTab={tab} initialFind={error ? [] : (data ?? [])} />
      </div>
    </main>
  );
}
