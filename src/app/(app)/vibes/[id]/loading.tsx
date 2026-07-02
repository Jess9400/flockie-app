import { SkeletonLine } from "@/components/skeletons";

export default function VibeDetailLoading() {
  return (
    <main className="px-5 pb-10 pt-6">
      <SkeletonLine className="mb-3 h-4 w-16" />

      {/* Category pill */}
      <div className="mt-4">
        <SkeletonLine className="h-6 w-20" />
      </div>

      {/* Cover + info */}
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        <div className="aspect-square w-full max-w-sm shrink-0 animate-pulse self-start rounded-2xl border-2 border-ink/10 bg-cream sm:w-1/2" />
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonLine className="h-7 w-3/4" />
          <SkeletonLine className="h-4 w-1/2" />
          <SkeletonLine className="h-4 w-2/3" />
          <SkeletonLine className="h-4 w-1/3" />
          <SkeletonLine className="mt-4 h-3.5 w-full" />
          <SkeletonLine className="h-3.5 w-full" />
          <SkeletonLine className="h-3.5 w-2/3" />
        </div>
      </div>

      {/* Host tag */}
      <SkeletonLine className="mt-4 h-8 w-48" />

      {/* Attendees / interest area */}
      <div className="mt-6 animate-pulse rounded-3xl border-2 border-ink/10 bg-white p-4">
        <SkeletonLine className="h-4 w-40" />
        <div className="mt-3 flex gap-2">
          <SkeletonLine className="h-10 w-10 rounded-full" />
          <SkeletonLine className="h-10 w-10 rounded-full" />
          <SkeletonLine className="h-10 w-10 rounded-full" />
        </div>
        <SkeletonLine className="mt-4 h-12 w-full" />
      </div>
    </main>
  );
}
