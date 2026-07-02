import { SkeletonCard, SkeletonLine } from "@/components/skeletons";

export default function VibesLoading() {
  return (
    <main className="px-5 pt-6">
      {/* Tabs pill */}
      <SkeletonLine className="mb-4 h-10 w-44" />
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-7 w-24" />
        <SkeletonLine className="h-9 w-24" />
      </div>
      <SkeletonLine className="mt-3 h-4 w-full max-w-xl" />
      <SkeletonLine className="mt-2 h-4 w-2/3 max-w-md" />

      {/* Search bar */}
      <SkeletonLine className="mt-4 h-12 w-full" />

      {/* Filter + view toggle */}
      <div className="mt-6 flex items-center justify-between gap-2">
        <SkeletonLine className="h-9 w-24" />
        <SkeletonLine className="h-9 w-44" />
      </div>

      {/* Cards grid */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}
