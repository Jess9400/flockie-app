import { SkeletonLine, SkeletonListRow } from "@/components/skeletons";

export default function ChatsLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-12 pt-6 lg:hidden">
      <SkeletonLine className="h-8 w-28" />

      {/* Filter chips */}
      <SkeletonLine className="mt-4 h-7 w-48" />

      <div className="mt-6">
        <SkeletonLine className="h-3.5 w-56" />
        <div className="mt-3 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonListRow key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
