"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type HomeActionItem = { id: string; title: string; body: string | null; href: string };

// "Needs your action" cards on Home. ✕ dismisses the underlying notification
// (same dismissed_at the inbox uses, so it disappears everywhere); acting on a
// request marks it read server-side, which also removes it from here.
export default function HomeActions({
  items,
  labels,
}: {
  items: HomeActionItem[];
  labels: { heading: string; review: string; dismiss: string };
}) {
  const supabase = createClient();
  const [list, setList] = useState(items);

  async function dismiss(id: string) {
    setList((cur) => cur.filter((a) => a.id !== id));
    await supabase
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);
  }

  if (list.length === 0) return null;

  return (
    <section className="mx-4 mt-6 space-y-3">
      <h2 className="px-1 text-[22px] font-extrabold sm:text-[28px]">{labels.heading}</h2>
      {list.map((a) => (
        <div key={a.id} className="relative rounded-2xl border-2 border-flockie-coral bg-white p-3">
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            aria-label={labels.dismiss}
            className="absolute right-2 top-2 rounded-full p-1 text-ink/40 hover:bg-cream hover:text-ink"
          >
            <X size={15} />
          </button>
          <div className="flex items-center gap-3 pr-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-flockie-coral/10 text-lg">
              🙋
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{a.title}</p>
              {a.body && <p className="truncate text-xs font-medium text-muted">{a.body}</p>}
            </div>
            <Link
              href={a.href}
              className="shrink-0 rounded-full border-2 border-ink bg-flockie-coral px-4 py-2 text-xs font-bold text-white shadow-[0_2px_0_0_#E0512C]"
            >
              {labels.review}
            </Link>
          </div>
        </div>
      ))}
    </section>
  );
}
