import { SkeletonLine, SkeletonListRow } from "@/components/skeletons";

export default function InboxLoading() {
  return (
    <main className="px-5 pt-6">
      <SkeletonLine className="h-7 w-24" />
      <SkeletonLine className="mt-2 h-4 w-64" />

      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonListRow key={i} />
        ))}
      </div>
    </main>
  );
}
