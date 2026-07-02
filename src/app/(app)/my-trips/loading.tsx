import { SkeletonLine, SkeletonListRow } from "@/components/skeletons";

export default function MyTripsLoading() {
  return (
    <main className="px-5 pb-10 pt-6">
      {/* Tabs pill */}
      <SkeletonLine className="mb-4 h-10 w-44" />
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-7 w-32" />
        <SkeletonLine className="h-9 w-24" />
      </div>
      <SkeletonLine className="mt-2 h-4 w-64" />

      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonListRow key={i} />
        ))}
      </div>
    </main>
  );
}
