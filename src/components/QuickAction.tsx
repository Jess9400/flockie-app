"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CHIPS = ["coffee", "surf", "yoga", "dinner", "coworking", "hike"];

export default function QuickAction({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    router.push(`/vibes/new?title=${encodeURIComponent(text.trim())}`);
  }

  return (
    <section className="px-5 py-10 text-center sm:py-16">
      <h1 className="text-[32px] font-black leading-tight sm:text-5xl">
        Hey {firstName} 👋
      </h1>
      <p className="mt-2 text-lg font-bold text-ink/70">
        What do you want to do today?
      </p>

      <form onSubmit={submit} className="mx-auto mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Surf in Bali, dinner in Lisbon, coffee tomorrow…"
          className="h-14 w-full rounded-2xl border-[3px] border-ink bg-cream px-5 font-medium outline-none transition-colors focus:border-flockie-blue sm:h-16"
        />
        <button
          type="submit"
          className="h-14 shrink-0 rounded-full border-[3px] border-ink bg-flockie-coral px-7 font-bold text-white transition-transform hover:scale-[1.02] sm:h-16"
        >
          Create a Vibe
        </button>
      </form>

      <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setText(c)}
            className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-bold hover:bg-cream"
          >
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
