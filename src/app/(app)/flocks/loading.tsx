import { SkeletonCard, SkeletonLine } from "@/components/skeletons";

export default function FlocksLoading() {
  return (
    <main className="px-5 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-7 w-40" />
        <SkeletonLine className="h-9 w-24" />
      </div>
      <SkeletonLine className="mt-2 h-4 w-64" />

      {/* Buddy / Flock toggle */}
      <SkeletonLine className="mt-4 h-11 w-full" />

      {/* Filters */}
      <SkeletonLine className="mt-4 h-9 w-24" />

      {/* Cards grid */}
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}
