"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

// Goes back to wherever the user came from (feed, directory, chat, roster…),
// falling back to a sensible route when there's no history (e.g. opened via a
// direct link).
export default function BackLink({ label, fallback = "/" }: { label: string; fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted hover:text-ink"
    >
      <ChevronLeft size={16} /> {label}
    </button>
  );
}
