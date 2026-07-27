import { SkeletonCarousel, SkeletonLine } from "@/components/skeletons";

export default function HomeLoading() {
  return (
    <div className="pb-24">
      {/* Hero greeting */}
      <section className="px-5 pt-12 text-center sm:pt-16">
        <SkeletonLine className="mx-auto h-9 w-64" />
        <SkeletonLine className="mx-auto mt-3 h-5 w-72" />
      </section>

      {/* Find a buddy - people carousel */}
      <section className="mx-4 mt-8">
        <SkeletonLine className="h-6 w-72" />
        <SkeletonLine className="mt-2 h-4 w-52" />
        <div className="mt-4 flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex w-40 shrink-0 flex-col items-center rounded-2xl border-2 border-ink/10 bg-white p-4"
            >
              <div className="h-[88px] w-[88px] animate-pulse rounded-full bg-cream" />
              <SkeletonLine className="mt-3 h-3.5 w-24" />
              <SkeletonLine className="mt-2 h-2.5 w-28" />
            </div>
          ))}
        </div>
      </section>

      {/* Happening near you - vibes carousel */}
      <section className="mx-4 mt-8 rounded-3xl border-2 border-ink/10 bg-white p-5 sm:p-6">
        <SkeletonLine className="h-6 w-56" />
        <SkeletonLine className="mt-2 h-4 w-64" />
        <div className="mt-4">
          <SkeletonCarousel count={3} />
        </div>
      </section>

      {/* Find a flock - carousel */}
      <section className="mx-4 mt-8">
        <SkeletonLine className="h-6 w-40" />
        <SkeletonLine className="mt-2 h-4 w-60" />
        <div className="mt-4">
          <SkeletonCarousel count={3} />
        </div>
      </section>
    </div>
  );
}
