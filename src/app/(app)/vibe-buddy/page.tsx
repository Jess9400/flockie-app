// Vibe Buddy — post an activity / join local ones (geolocation + group chat).
// Full feature in Phase 3.
export default function VibeBuddyPage() {
  return (
    <main className="px-5 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Vibe Buddy</h1>
        <button className="rounded-full border-2 border-ink bg-flockie-orange px-4 py-1.5 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C]">
          + Post
        </button>
      </div>
      <p className="mt-1 text-sm font-medium text-muted">
        Find someone to do something with, near you or anywhere.
      </p>

      <div className="mt-6 flex h-[60vh] items-center justify-center rounded-3xl border-2 border-dashed border-ink/30 text-center text-muted">
        <p className="px-8 font-medium">
          Local activity feed + create-a-vibe (description, photos, group size)
          and group chat (Phase 3).
        </p>
      </div>
    </main>
  );
}
