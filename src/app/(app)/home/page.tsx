import Link from "next/link";
import { ArrowRight, CalendarHeart, Mail, Megaphone, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VibeCard, { type VibeCardData } from "@/components/VibeCard";
import QuickAction from "@/components/QuickAction";
import { formatVibeWhen } from "@/lib/vibes";

type RecommendedVibe = VibeCardData & { host_id: string; match_score: number };

async function loadHostsAndCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  list: { id: string; host_id: string }[]
) {
  const hosts: Record<string, { display_name: string | null; photos: string[] | null }> = {};
  const counts: Record<string, number> = {};
  const hostIds = Array.from(new Set(list.map((v) => v.host_id)));
  const ids = list.map((v) => v.id);

  if (hostIds.length) {
    const { data: hp } = await supabase
      .from("profiles")
      .select("id, display_name, photos")
      .in("id", hostIds);
    hp?.forEach((h) => (hosts[h.id] = { display_name: h.display_name, photos: h.photos }));
  }
  if (ids.length) {
    const { data: confirmed } = await supabase
      .from("vibe_interests")
      .select("vibe_id")
      .eq("status", "confirmed")
      .in("vibe_id", ids);
    confirmed?.forEach((r) => (counts[r.vibe_id] = (counts[r.vibe_id] ?? 0) + 1));
  }
  return { hosts, counts };
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, home_city, onboarding_complete")
    .eq("id", user!.id)
    .maybeSingle();

  const firstName = (profile?.display_name?.trim() || "there").split(" ")[0];
  const homeCity = profile?.home_city?.trim() || null;
  const nowIso = new Date().toISOString();
  const in48Iso = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  // ── Section 3: Happening near you (next 48h, in your city) ─────────────
  let nearQuery = supabase
    .from("vibes")
    .select(
      "id, host_id, title, category, photos, city, location_name, starts_at, capacity, event_vibe_tags"
    )
    .in("status", ["open", "ranking", "finalized"])
    .gte("starts_at", nowIso)
    .lte("starts_at", in48Iso)
    .order("starts_at", { ascending: true })
    .limit(10);
  if (homeCity) nearQuery = nearQuery.ilike("city", homeCity);
  const { data: nearRaw } = await nearQuery;
  const near = nearRaw ?? [];
  const nearMeta = await loadHostsAndCounts(supabase, near);

  // ── Section 4: Your Vibes (action items) ───────────────────────────────
  type Row = {
    key: string;
    href: string;
    icon: "invite" | "going" | "hosting";
    title: string;
    sub: string;
    starts_at: string;
  };
  const rows: Row[] = [];

  const { data: myInterests } = await supabase
    .from("vibe_interests")
    .select("vibe_id, status")
    .eq("user_id", user!.id)
    .in("status", ["invited", "confirmed"]);

  const interestVibeIds = (myInterests ?? []).map((i) => i.vibe_id);
  const statusByVibe = new Map<string, string>(
    (myInterests ?? []).map((i) => [i.vibe_id, i.status])
  );

  if (interestVibeIds.length) {
    const { data: iv } = await supabase
      .from("vibes")
      .select("id, title, starts_at")
      .in("id", interestVibeIds)
      .gte("starts_at", nowIso);
    iv?.forEach((v) => {
      const st = statusByVibe.get(v.id);
      if (st === "invited") {
        rows.push({
          key: `inv-${v.id}`,
          href: `/vibes/${v.id}`,
          icon: "invite",
          title: `You're invited to ${v.title}`,
          sub: `Respond before it fills · ${formatVibeWhen(v.starts_at)}`,
          starts_at: v.starts_at,
        });
      } else if (st === "confirmed") {
        rows.push({
          key: `go-${v.id}`,
          href: `/vibes/${v.id}`,
          icon: "going",
          title: `You're going to ${v.title}`,
          sub: formatVibeWhen(v.starts_at),
          starts_at: v.starts_at,
        });
      }
    });
  }

  const { data: hosting } = await supabase
    .from("vibes")
    .select("id, title, starts_at, status")
    .eq("host_id", user!.id)
    .in("status", ["open", "ranking"])
    .gte("starts_at", nowIso);
  hosting?.forEach((v) =>
    rows.push({
      key: `host-${v.id}`,
      href: `/vibes/${v.id}`,
      icon: "hosting",
      title: `${v.title} is recruiting`,
      sub: `You're hosting · ${formatVibeWhen(v.starts_at)}`,
      starts_at: v.starts_at,
    })
  );

  rows.sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const yourVibes = rows.slice(0, 5);

  // ── Section 5: Picked for you ──────────────────────────────────────────
  let recommended: RecommendedVibe[] = [];
  if (profile?.onboarding_complete) {
    const { data: rec } = await supabase.rpc("recommended_vibes", { p_limit: 6 });
    recommended = (rec ?? []) as RecommendedVibe[];
  }
  const recMeta = await loadHostsAndCounts(supabase, recommended);

  return (
    <div className="pb-4">
      {/* Section 2 — Quick action hero (cream) */}
      <QuickAction firstName={firstName} />

      {/* Section 3 — Happening near you (sky blue) */}
      <section className="mx-4 mt-2 rounded-3xl border-[3px] border-ink bg-flockie-blue p-5 text-white sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-extrabold sm:text-[28px]">Happening near you</h2>
            <p className="mt-0.5 font-bold text-white/80">
              {homeCity ? `Next 48 hours in ${homeCity}` : "In the next 48 hours"}
            </p>
          </div>
          <Link
            href="/vibes"
            className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink"
          >
            See all <ArrowRight size={15} />
          </Link>
        </div>

        {near.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-white/40 bg-white/10 p-6 text-center">
            <p className="font-bold">Nothing in the next 48 hours{homeCity ? ` in ${homeCity}` : ""} yet.</p>
            <p className="mt-1 text-sm font-medium text-white/80">
              Be the one who starts something.
            </p>
            <Link
              href="/vibes/new"
              className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-flockie-coral px-5 py-2 text-sm font-bold text-white"
            >
              Create a Vibe
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {near.map((v) => (
              <div key={v.id} className="w-72 shrink-0 snap-start">
                <VibeCard
                  vibe={{ ...v, host: nearMeta.hosts[v.host_id] ?? null } as VibeCardData}
                  confirmedCount={nearMeta.counts[v.id] ?? 0}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 4 — Your Vibes (cream rows) */}
      <section className="mx-4 mt-6">
        <div className="flex items-end justify-between gap-3 px-1">
          <h2 className="text-[22px] font-extrabold sm:text-[28px]">Your Vibes</h2>
          <Link
            href="/my-vibes"
            className="flex shrink-0 items-center gap-1 text-sm font-bold text-flockie-coral"
          >
            See all <ArrowRight size={15} />
          </Link>
        </div>

        {yourVibes.length === 0 ? (
          <div className="mt-3 rounded-3xl border-2 border-dashed border-ink/25 bg-white p-6 text-center">
            <p className="font-bold">No invitations or plans yet.</p>
            <p className="mt-1 text-sm font-medium text-muted">
              Join a Vibe near you or start your own — they&rsquo;ll show up here.
            </p>
            <Link
              href="/vibes"
              className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-flockie-blue px-5 py-2 text-sm font-bold text-white"
            >
              Browse Vibes
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {yourVibes.map((r) => {
              const Icon =
                r.icon === "invite" ? Mail : r.icon === "hosting" ? Megaphone : CalendarHeart;
              return (
                <li key={r.key}>
                  <Link
                    href={r.href}
                    className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 transition-transform hover:-translate-y-0.5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-cream">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{r.title}</span>
                      <span className="block truncate text-sm font-medium text-muted">{r.sub}</span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section 5 — Picked for you (coral) */}
      <section className="mx-4 mt-6 rounded-3xl border-[3px] border-ink bg-flockie-coral p-5 text-white sm:p-6">
        <h2 className="text-[22px] font-extrabold sm:text-[28px]">Picked for you</h2>
        <p className="mt-0.5 font-bold text-white/80">
          Vibes matched to how you like to hang out.
        </p>

        {!profile?.onboarding_complete ? (
          <div className="mt-4 rounded-2xl border-2 border-white/40 bg-white/10 p-6 text-center">
            <Sparkles className="mx-auto" size={24} />
            <p className="mt-2 font-bold">Finish your vibe check to unlock matches.</p>
            <p className="mt-1 text-sm font-medium text-white/80">
              A few quick questions and we&rsquo;ll start picking Vibes for you.
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-5 py-2 text-sm font-bold text-ink"
            >
              Complete vibe check <ArrowRight size={15} />
            </Link>
          </div>
        ) : recommended.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-white/40 bg-white/10 p-6 text-center">
            <p className="font-bold">No matches{homeCity ? ` in ${homeCity}` : ""} right now.</p>
            <p className="mt-1 text-sm font-medium text-white/80">
              Check back soon — new Vibes go up every day.
            </p>
            <Link
              href="/vibes"
              className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-5 py-2 text-sm font-bold text-ink"
            >
              Browse all Vibes <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {recommended.map((v) => (
              <VibeCard
                key={v.id}
                vibe={{ ...v, host: recMeta.hosts[v.host_id] ?? null } as VibeCardData}
                confirmedCount={recMeta.counts[v.id] ?? 0}
                matchPct={v.match_score}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
