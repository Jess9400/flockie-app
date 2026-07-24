"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Follow / Following toggle — backed by toggle_follow (notifies once, no spam).
export default function FollowButton({
  userId,
  initialFollowing,
  compact = false,
}: {
  userId: string;
  initialFollowing: boolean;
  compact?: boolean;
}) {
  const supabase = createClient();
  const t = useTranslations("feed.follow");
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setFollowing((f) => !f); // optimistic
    const { data, error } = await supabase.rpc("toggle_follow", { p_user: userId });
    setBusy(false);
    if (error) setFollowing((f) => !f);
    else setFollowing(!!data);
  }

  const size = compact ? "px-3.5 py-1.5 text-[11.5px]" : "px-4 py-2 text-xs";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      className={`shrink-0 rounded-full font-bold transition-colors disabled:opacity-60 ${size} ${
        following
          ? "bg-onboarding-green/10 text-onboarding-green"
          : "bg-flockie-coral text-white"
      }`}
    >
      {following ? t("following") : t("follow")}
    </button>
  );
}
