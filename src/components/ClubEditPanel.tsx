"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Host edits the club's identity (name + description). Direct table update -
// the "clubs host update" RLS policy scopes it to the owner.
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
    setMsg(t("saved"));
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-white/80 px-4 py-2 text-sm font-bold text-ink shadow-[0_2px_10px_rgba(10,37,69,0.08)]"
      >
        ✏️ {t("cta")}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-ink/15 bg-cream p-3">
      <label className="block text-sm font-bold text-ink">
        {t("titleLabel")}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="mt-1 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 font-medium outline-none"
        />
      </label>
      <label className="mt-2 block text-sm font-bold text-ink">
        {t("descriptionLabel")}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={600}
          rows={3}
          className="mt-1 w-full resize-y rounded-xl border border-ink/25 bg-white px-3 py-2 font-medium outline-none"
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full border border-ink/15 bg-flockie-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {t("save")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
        >
          {t("cancel")}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
