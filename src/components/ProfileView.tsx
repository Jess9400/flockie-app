import {
  SLIDERS,
  ACTIVITY_SOCIAL_SCALE,
  INTENSITY_SCALE,
  SKILL_SCALE,
  type Profile,
} from "@/lib/vibe-check";

function Chips({ items }: { items?: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-bold">
          {t}
        </span>
      ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-ink bg-white p-4">
      <p className="text-sm font-extrabold">{title}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function ProfileView({ profile }: { profile: Partial<Profile> }) {
  const p = profile;
  const photos = p.photos ?? [];
  const skills = (p.activity_skills ?? {}) as Record<string, number>;

  const basics = [
    p.age ? `${p.age}` : null,
    p.gender,
    p.relationship_status,
    p.home_city,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="aspect-square w-full rounded-2xl border-2 border-ink object-cover"
            />
          ))}
        </div>
      )}

      {p.video_url && (
        <video
          src={p.video_url}
          controls
          className="w-full rounded-2xl border-2 border-ink"
        />
      )}

      {(p.display_name || basics.length > 0) && (
        <Block title="About">
          {p.display_name && <p className="text-lg font-extrabold">{p.display_name}</p>}
          {basics.length > 0 && (
            <p className="text-sm font-medium text-muted">{basics.join(" · ")}</p>
          )}
        </Block>
      )}

      {p.one_liner && (
        <Block title="On a trip, I'm the kind of person who…">
          <p className="font-medium text-ink/80">{p.one_liner}</p>
        </Block>
      )}

      <Block title="Travel vibe">
        <ul className="space-y-1.5">
          {SLIDERS.map((s) => {
            const val = p[s.key] as number | null | undefined;
            if (val == null) return null;
            return (
              <li key={s.key} className="text-sm">
                <span className="font-bold">{s.label}: </span>
                <span className="text-ink/70">{s.scale[val - 1]}</span>
              </li>
            );
          })}
        </ul>
        {(p.trip_vibe?.length ?? 0) > 0 && (
          <>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Trip vibe</p>
            <Chips items={p.trip_vibe} />
          </>
        )}
        {(p.travel_style?.length ?? 0) > 0 && (
          <>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Travel style</p>
            <Chips items={p.travel_style} />
          </>
        )}
        {(p.dealbreakers?.length ?? 0) > 0 && (
          <>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Hard preferences</p>
            <Chips items={p.dealbreakers} />
          </>
        )}
      </Block>

      {(p.activities?.length ?? 0) > 0 && (
        <Block title="Activities">
          <ul className="space-y-1">
            {(p.activities ?? []).map((a) => (
              <li key={a} className="flex items-center justify-between text-sm">
                <span className="font-bold">{a}</span>
                {skills[a] && (
                  <span className="text-xs font-semibold text-flockie-orange">
                    {SKILL_SCALE[skills[a] - 1]}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 text-sm">
            {p.activity_social != null && (
              <p>
                <span className="font-bold">Social style: </span>
                <span className="text-ink/70">{ACTIVITY_SOCIAL_SCALE[p.activity_social - 1]}</span>
              </p>
            )}
            {p.activity_intensity != null && (
              <p>
                <span className="font-bold">Intensity: </span>
                <span className="text-ink/70">{INTENSITY_SCALE[p.activity_intensity - 1]}</span>
              </p>
            )}
          </div>
          {(p.activity_vibe?.length ?? 0) > 0 && <Chips items={p.activity_vibe} />}
          {p.activity_one_liner && (
            <p className="mt-3 text-sm">
              <span className="font-bold">At an activity: </span>
              <span className="text-ink/70">{p.activity_one_liner}</span>
            </p>
          )}
        </Block>
      )}
    </div>
  );
}
