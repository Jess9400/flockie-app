"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole, MapPin, Sparkles, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import GenerateCoverButton from "@/components/GenerateCoverButton";

type Cadence = "weekly" | "biweekly" | "monthly";
type Openness = "discoverable" | "invite_only";

const activityKeys = ["activityCoffee", "activitySport", "activityCreative", "activityOutdoors", "activityGames"] as const;

const inputClass =
  "mt-2 w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm font-semibold text-ink outline-none placeholder:text-ink/35 focus:border-flockie-blue";

export default function CreateFormingClub({ defaultCity, userId }: { defaultCity: string; userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.create");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [area, setArea] = useState("");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [openness, setOpenness] = useState<Openness>("discoverable");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clubTitle, setClubTitle] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [coverDetail, setCoverDetail] = useState("");
  const [uploading, setUploading] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const coverPrompt = [
    title.trim() && `Club name: ${title.trim()}`,
    category.trim() && `Activity: ${category.trim()}`,
    description.trim() && `About the club: ${description.trim()}`,
    city.trim() && `Location: ${[area.trim(), city.trim()].filter(Boolean).join(", ")}`,
    coverDetail.trim() && `Visual detail: ${coverDetail.trim()}`,
  ]
    .filter(Boolean)
    .join(". ");

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/club-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      setCover(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch {
      setError(t("coverUploadError"));
    } finally {
      setUploading(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !city.trim()) {
      setError(t("required"));
      return;
    }

    setSaving(true);
    const { data: createdClubId, error: rpcError } = await supabase.rpc("create_forming_club", {
      p_title: title.trim(),
      p_description: description.trim(),
      p_city: city.trim(),
      p_area: area.trim() || null,
      p_category: category.trim() || null,
      p_cover_photo: cover,
      p_cadence: cadence,
      p_openness: openness,
    });
    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setClubTitle(title.trim());
    setClubId(createdClubId as string);
  }

  if (clubTitle) {
    return (
      <section className="mt-8 rounded-3xl border border-ink/15 bg-white p-6 text-center shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-flockie-blue text-white">
          <Sparkles size={28} />
        </span>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-flockie-coral">{t("successEyebrow")}</p>
        <h2 className="mt-2 text-2xl font-black text-ink">{t("successTitle", { title: clubTitle })}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-muted">{t("successBody")}</p>
        <div className="mx-auto mt-6 grid max-w-md gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => clubId && router.push(`/clubs/${clubId}`)}
            className="rounded-full bg-flockie-coral px-4 py-3 text-sm font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
          >
            {t("viewClub")}
          </button>
          <button
            type="button"
            onClick={() => {
              setClubTitle(null);
              setTitle("");
              setCategory("");
              setDescription("");
              setArea("");
              setCover(null);
              setCoverDetail("");
            }}
            className="rounded-full border-2 border-ink/20 bg-white px-4 py-3 text-sm font-extrabold text-ink"
          >
            {t("startAnother")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-7 pb-4">
      <section className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
        <div className="flex items-start gap-3 rounded-2xl bg-flockie-blue/10 p-4">
          <UsersRound className="mt-0.5 shrink-0 text-flockie-blue" size={22} />
          <div>
            <h2 className="font-extrabold text-ink">{t("howItWorksTitle")}</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("howItWorksBody")}</p>
          </div>
        </div>

        <label className="mt-6 block text-sm font-extrabold text-ink">
          {t("nameLabel")}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder={t("namePlaceholder")}
            className={inputClass}
          />
        </label>

        <label className="mt-5 block text-sm font-extrabold text-ink">
          {t("activityLabel")}
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={80}
            placeholder={t("activityPlaceholder")}
            className={inputClass}
          />
        </label>
        <div className="mt-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("suggestedActivities")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {activityKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(t(key))}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                  category === t(key)
                    ? "border-flockie-blue bg-flockie-blue text-white"
                    : "border-ink/15 bg-cream text-ink hover:border-flockie-blue"
                }`}
              >
                {category === t(key) && <Check className="mr-1 inline" size={13} />}
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 block text-sm font-extrabold text-ink">
          {t("descriptionLabel")} <span className="font-semibold text-muted">· {t("descriptionOptional")}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={600}
            rows={4}
            placeholder={t("descriptionPlaceholder")}
            className={`${inputClass} resize-none`}
          />
        </label>
      </section>

      <section className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
        <span className="block text-sm font-extrabold text-ink">{t("coverLabel")}</span>
        <p className="mt-1 text-sm font-medium text-muted">{t("coverHelp")}</p>
        <label className="mt-5 block text-sm font-extrabold text-ink">
          {t("coverDetailLabel")} <span className="font-semibold text-muted">· {t("descriptionOptional")}</span>
          <input
            value={coverDetail}
            onChange={(event) => setCoverDetail(event.target.value)}
            maxLength={160}
            placeholder={t("coverDetailPlaceholder")}
            className={inputClass}
          />
        </label>

        {cover ? (
          <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl border border-ink/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setCover(null)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
              aria-label={t("coverRemoveAria")}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={uploading}
            className="mt-5 flex aspect-[16/9] w-full items-center justify-center rounded-2xl border-2 border-dashed border-ink/40 text-sm font-bold text-muted disabled:opacity-50"
          >
            {uploading ? t("coverUploading") : t("coverUpload")}
          </button>
        )}
        <GenerateCoverButton
          userId={userId}
          prompt={coverPrompt}
          disabled={uploading || !title.trim()}
          label={cover ? t("coverTryAnother") : undefined}
          onUploaded={(url) => setCover(url)}
        />
        {!title.trim() && <p className="mt-2 text-xs font-bold text-muted">{t("coverNeedsName")}</p>}
        <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={onCover} />
      </section>

      <section className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-extrabold text-ink">
            {t("cityLabel")}
            <span className="relative block">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-flockie-coral" size={18} />
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                maxLength={80}
                placeholder={t("cityPlaceholder")}
                className={`${inputClass} pl-10`}
              />
            </span>
          </label>
          <label className="block text-sm font-extrabold text-ink">
            {t("areaLabel")} <span className="font-semibold text-muted">· {t("areaOptional")}</span>
            <input
              value={area}
              onChange={(event) => setArea(event.target.value)}
              maxLength={80}
              placeholder={t("areaPlaceholder")}
              className={inputClass}
            />
          </label>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-extrabold text-ink">{t("cadenceLabel")}</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(["weekly", "biweekly", "monthly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCadence(option)}
                className={`rounded-2xl border-2 px-3 py-3 text-sm font-extrabold transition-colors ${
                  cadence === option
                    ? "border-flockie-blue bg-flockie-blue text-white"
                    : "border-ink/15 bg-white text-ink hover:border-flockie-blue"
                }`}
              >
                {t(option)}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-3xl border border-ink/15 bg-white p-5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] sm:p-6">
        <fieldset>
          <legend className="text-sm font-extrabold text-ink">{t("visibilityLabel")}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <VisibilityOption
              selected={openness === "discoverable"}
              onClick={() => setOpenness("discoverable")}
              icon={<Sparkles size={20} />}
              title={t("discoverable")}
              help={t("discoverableHelp")}
            />
            <VisibilityOption
              selected={openness === "invite_only"}
              onClick={() => setOpenness("invite_only")}
              icon={<LockKeyhole size={20} />}
              title={t("inviteOnly")}
              help={t("inviteOnlyHelp")}
            />
          </div>
        </fieldset>
      </section>

      {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-flockie-coral px-5 py-4 text-base font-extrabold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? t("creating") : t("create")}
      </button>
    </form>
  );
}

function VisibilityOption({
  selected,
  onClick,
  icon,
  title,
  help,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  help: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl border-2 p-4 text-left transition-colors ${
        selected ? "border-flockie-blue bg-flockie-blue/10" : "border-ink/15 bg-white hover:border-flockie-blue"
      }`}
    >
      {selected && <Check className="absolute right-3 top-3 text-flockie-blue" size={18} />}
      <span className="text-flockie-coral">{icon}</span>
      <span className="mt-2 block text-sm font-extrabold text-ink">{title}</span>
      <span className="mt-1 block text-xs font-medium leading-relaxed text-muted">{help}</span>
    </button>
  );
}
