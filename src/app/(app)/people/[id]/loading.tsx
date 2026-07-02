import { SkeletonLine } from "@/components/skeletons";

export default function PersonLoading() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 sm:pb-12">
      <SkeletonLine className="mb-3 h-4 w-16" />

      <div className="grid gap-4 sm:grid-cols-[320px,1fr]">
        {/* Identity card */}
        <div className="animate-pulse overflow-hidden rounded-3xl border-2 border-ink/10 bg-white">
          <div className="aspect-square w-full bg-cream" />
          <div className="space-y-2.5 p-4">
            <SkeletonLine className="h-5 w-2/3" />
            <SkeletonLine className="h-3.5 w-1/2" />
            <SkeletonLine className="h-3.5 w-3/4" />
          </div>
        </div>

        {/* Bio / stats / reviews */}
        <div className="space-y-4">
          <div className="rounded-3xl border-2 border-ink/10 bg-white p-4">
            <SkeletonLine className="h-4 w-32" />
            <SkeletonLine className="mt-3 h-3.5 w-full" />
            <SkeletonLine className="mt-2 h-3.5 w-5/6" />
          </div>
          <div className="rounded-3xl border-2 border-ink/10 bg-white p-4">
            <SkeletonLine className="h-4 w-40" />
            <div className="mt-3 flex gap-2">
              <SkeletonLine className="h-8 w-20" />
              <SkeletonLine className="h-8 w-20" />
              <SkeletonLine className="h-8 w-20" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
