"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import FingerprintBar from "@/components/FingerprintBar";
import PhotoStrip from "@/components/PhotoStrip";
import ProfileReviews, { type ReviewItem } from "@/components/ProfileReviews";
import ProfileStats from "@/components/ProfileStats";
import ProfileEvents, { type EventsData } from "@/components/ProfileEvents";
import VibeQuizResult from "@/components/VibeQuizResult";
import TripVibeForm from "@/components/TripVibeForm";
import ActivityVibeForm from "@/components/ActivityVibeForm";
import { restartVibeCheck } from "@/lib/onboarding/vibe-actions";
import {
  SLIDERS,
  SKILL_CATEGORIES,
  SKILL_SCALE,
  ACTIVITY_SOCIAL_SCALE,
  INTENSITY_SCALE,
  type Profile,
} from "@/lib/vibe-check";
import type { VibeScores } from "@/lib/onboarding/types";

type ProfileData = Partial<Profile> & {
  archetype?: string | null;
  vibe_scores?: VibeScores | null;
  trip_prefs_complete?: boolean | null;
  activity_prefs_complete?: boolean | null;
};

type TabKey = "profile" | "quiz" | "trip" | "activity" | "reviews";

const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "quiz", label: "Vibe quiz" },
  { key: "trip", label: "Trip vibe" },
  { key: "activity", label: "Activity vibe" },
  { key: "reviews", label: "Reviews" },
];

export default function ProfileTabs({
  userId,
  profile,
  reviewAvg,
  reviewCount,
  reviewItems,
  onEditProfile,
  stats,
  events,
}: {
  userId: string;
  profile: ProfileData;
  reviewAvg: number;
  reviewCount: number;
  reviewItems: ReviewItem[];
  onEditProfile: () => void;
  stats?: Record<string, number>;
  events?: EventsData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("profile");
  const [openWizard, setOpenWizard] = useState<"trip" | "activity" | null>(null);
  const [redoing, setRedoing] = useState(false);
  const p = profile;

  function wizardDone() {
    setOpenWizard(null);
    router.refresh();
  }

  async function redoQuiz() {
    setRedoing(true);
    try {
      await restartVibeCheck();
      router.push("/onboarding/vibe-check");
    } catch {
      setRedoing(false);
    }
  }

  const tripFilled = !!p.trip_prefs_complete || p.planning != null;
  const activityFilled = !!p.activity_prefs_complete || (p.activities?.length ?? 0) > 0;
  const skills = SKILL_CATEGORIES.filter((c) => (p.activity_skills?.[c.value] ?? 0) > 0);

  return (
    <div className="font-nunito">
      {/* Tab bar */}
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full border-2 border-navy px-4 py-2 font-fredoka text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-navy text-white" : "bg-white text-navy hover:bg-cream"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {/* PROFILE */}
        {tab === "profile" && (
          <TabShell title="Profile" onEdit={onEditProfile}>
            {p.photos?.[0] ? (
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(10,37,69,0.18)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photos[0]} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy/80 to-transparent" />
                <p className="absolute bottom-5 left-5 font-fredoka text-4xl font-bold text-white drop-shadow-sm">
                  {[p.display_name?.trim(), p.age ? String(p.age) : null].filter(Boolean).join(", ")}
                </p>
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-cream text-5xl">🕊️</div>
            )}
            {p.home_city && <p className="mt-4 text-base font-semibold text-navy">📍 {p.home_city}</p>}
            {p.bio && (
              <p className="mt-3 whitespace-pre-line text-[15px] font-medium leading-relaxed text-navy/80">{p.bio}</p>
            )}
            {(p.photos?.length ?? 0) > 1 && (
              <div className="mt-5">
                <PhotoStrip photos={p.photos!.slice(1)} />
              </div>
            )}
            {p.video_url && <video src={p.video_url} controls className="mt-5 w-full rounded-2xl" />}
            <Socials instagram={p.instagram} x={p.x_handle} tiktok={p.tiktok} />
            {stats && <div className="mt-6"><ProfileStats stats={stats} /></div>}
            {events && <div className="mt-6"><ProfileEvents data={events} isOwner /></div>}
          </TabShell>
        )}

        {/* VIBE QUIZ */}
        {tab === "quiz" &&
          (p.archetype ? (
            <TabShell title="Vibe quiz" editLabel={redoing ? "Resetting…" : "Redo quiz"} onEdit={redoing ? undefined : redoQuiz}>
              <VibeQuizResult archetypeKey={p.archetype} scores={p.vibe_scores} />
            </TabShell>
          ) : (
            <EmptyCTA
              title="Take the vibe quiz"
              body="Five quick questions to reveal your travel persona and power your matches."
              cta="Start the vibe quiz"
              onClick={() => router.push("/onboarding/vibe-check")}
            />
          ))}

        {/* TRIP VIBE */}
        {tab === "trip" &&
          (tripFilled ? (
            <TabShell title="Trip vibe" onEdit={() => setOpenWizard("trip")}>
              <Section title="How you travel">
                <div className="space-y-6 rounded-2xl border-2 border-ink/10 bg-white p-4">
                  {SLIDERS.map((s) => {
                    const val = p[s.key] as number | null | undefined;
                    if (val == null) return null;
                    return (
                      <FingerprintBar
                        key={s.key}
                        title={s.label}
                        leftLabel={s.scale[0]}
                        rightLabel={s.scale[4]}
                        value={val}
                        answer={s.scale[val - 1]}
                      />
                    );
                  })}
                </div>
              </Section>
              <ChipGroup label="Trip vibe" items={p.trip_vibe} />
              <ChipGroup label="Travel style" items={p.travel_style} />
              <ChipGroup label="Hard preferences" items={p.dealbreakers} />
              {p.one_liner && (
                <Section title="In their words">
                  <Quote text={p.one_liner} />
                </Section>
              )}
            </TabShell>
          ) : (
            <EmptyCTA
              title="Add your trip vibe"
              body="How you travel — pace, budget, nightlife and more. Needed to match on trips."
              cta="Fill your trip vibe"
              onClick={() => setOpenWizard("trip")}
            />
          ))}

        {/* ACTIVITY VIBE */}
        {tab === "activity" &&
          (activityFilled ? (
            <TabShell title="Activity vibe" onEdit={() => setOpenWizard("activity")}>
              <ChipGroup label="Activities" items={p.activities} />
              <ChipGroup label="Activity vibe" items={p.activity_vibe} />
              {skills.length > 0 && (
                <Section title="Skill levels">
                  <div className="space-y-2">
                    {skills.map((c) => (
                      <div
                        key={c.value}
                        className="flex items-center justify-between rounded-2xl border-2 border-ink/10 bg-white px-4 py-2.5"
                      >
                        <span className="text-sm font-semibold text-navy">{c.emoji} {c.label}</span>
                        <span className="text-sm font-bold text-flockie-coral">
                          {SKILL_SCALE[(p.activity_skills![c.value] ?? 1) - 1]}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {(p.activity_social != null || p.activity_intensity != null) && (
                <Section title="How they like it">
                  <div className="space-y-2">
                    {p.activity_social != null && (
                      <Line label="Group size" value={ACTIVITY_SOCIAL_SCALE[p.activity_social - 1]} />
                    )}
                    {p.activity_intensity != null && (
                      <Line label="Intensity" value={INTENSITY_SCALE[p.activity_intensity - 1]} />
                    )}
                  </div>
                </Section>
              )}
              <ChipGroup label="Hard preferences" items={p.activity_dealbreakers} />
              {p.activity_one_liner && (
                <Section title="In their words">
                  <Quote text={p.activity_one_liner} />
                </Section>
              )}
            </TabShell>
          ) : (
            <EmptyCTA
              title="Add your activity vibe"
              body="What you're into, your skill level and how you like to do it. Needed to match on activities."
              cta="Fill your activity vibe"
              onClick={() => setOpenWizard("activity")}
            />
          ))}

        {/* REVIEWS */}
        {tab === "reviews" && <ProfileReviews avg={reviewAvg} count={reviewCount} items={reviewItems} />}
      </div>

      {openWizard === "trip" && <TripVibeForm userId={userId} onDone={wizardDone} onClose={() => setOpenWizard(null)} />}
      {openWizard === "activity" && <ActivityVibeForm userId={userId} onDone={wizardDone} onClose={() => setOpenWizard(null)} />}
    </div>
  );
}

function TabShell({
  title,
  editLabel = "Edit",
  onEdit,
  children,
}: {
  title: string;
  editLabel?: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-fredoka text-xl font-bold text-navy">{title}</h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-navy bg-white px-4 py-1.5 font-fredoka text-sm font-semibold text-navy hover:bg-cream"
          >
            <Pencil size={14} /> {editLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyCTA({
  title,
  body,
  cta,
  onClick,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-navy/30 bg-white p-8 text-center">
      <p className="font-fredoka text-lg font-bold text-navy">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm font-medium text-navy/60">{body}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-5 inline-block rounded-full border-2 border-navy bg-flockie-coral px-6 py-3 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
      >
        {cta}
      </button>
    </div>
  );
}

// Shared styling with the Vibe quiz tab (VibeQuizResult): uppercase muted
// section headers, white bordered cards and chips.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function ChipGroup({ label, items }: { label: string; items?: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <Section title={label}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span
            key={t}
            className="rounded-full border-2 border-ink/10 bg-white px-3.5 py-2 text-[12.5px] font-bold text-navy"
          >
            {t}
          </span>
        ))}
      </div>
    </Section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-ink/10 bg-white px-4 py-2.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm font-bold text-navy">{value}</span>
    </div>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <figure className="relative mt-8 px-6 py-8 text-center">
      <span className="absolute left-0 top-0 font-fredoka text-5xl leading-none text-flockie-coral">&ldquo;</span>
      <blockquote className="font-fredoka text-xl font-medium italic text-navy">{text}</blockquote>
      <span className="absolute bottom-0 right-2 font-fredoka text-5xl leading-none text-flockie-coral">&rdquo;</span>
    </figure>
  );
}

function Socials({ instagram, x, tiktok }: { instagram?: string | null; x?: string | null; tiktok?: string | null }) {
  const clean = (h: string) => h.replace(/^@/, "").trim();
  const links = [
    instagram && { label: "Instagram", href: `https://instagram.com/${clean(instagram)}` },
    x && { label: "X", href: `https://x.com/${clean(x)}` },
    tiktok && { label: "TikTok", href: `https://tiktok.com/@${clean(tiktok)}` },
  ].filter(Boolean) as { label: string; href: string }[];
  if (links.length === 0) return null;
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border-2 border-navy bg-white px-4 py-2 text-sm font-bold text-navy hover:bg-cream"
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}
