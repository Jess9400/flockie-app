"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Settings, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Host edits the club's identity (name + description). Gear icon in the club
// header opening a modal, mirroring the profile-page settings pattern. Direct
// table update - the "clubs host update" RLS policy scopes it to the owner.
export default function ClubEditPanel({
  clubId,
  initialTitle,
  initialDescription,
}: {
  clubId: string;
  initialTitle: string;
  initialDescription: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("clubs.edit");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (title.trim().length < 3) return setMsg(t("errTitle"));
    setBusy(true);
    setMsg(null);
    const { error } = await supabase
      .from("clubs")
      .update({ title: title.trim(), description: description.trim() })
      .eq("id", clubId);
    setBusy(false);
    if (error) return setMsg(error.message);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("cta")}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white/90 text-navy shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
      >
        <Settings size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-navy/55 p-0 sm:items-center sm:justify-center sm:p-6">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black text-ink">{t("cta")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("cancel")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-navy"
              >
                <X size={16} />
              </button>
            </div>

            <label className="mt-4 block text-sm font-bold text-ink">
              {t("titleLabel")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 font-medium outline-none"
              />
            </label>
            <label className="mt-3 block text-sm font-bold text-ink">
              {t("descriptionLabel")}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={600}
                rows={4}
                className="mt-1 w-full resize-y rounded-xl border border-ink/25 bg-white px-3 py-2 font-medium outline-none"
              />
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-2xl border border-ink/15 bg-flockie-orange px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm font-extrabold text-navy"
              >
                {t("cancel")}
              </button>
            </div>
            {msg && <p className="mt-3 text-sm font-bold text-red-600">{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
