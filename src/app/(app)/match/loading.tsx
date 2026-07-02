import { SkeletonLine } from "@/components/skeletons";

export default function MatchLoading() {
  return (
    <main className="px-5 pb-10 pt-6">
      <SkeletonLine className="h-7 w-44" />
      <SkeletonLine className="mt-2 h-4 w-full max-w-md" />

      {/* Buddy / Flock toggle */}
      <SkeletonLine className="mt-4 h-11 w-full" />

      {/* Candidate card */}
      <div className="mt-6 animate-pulse overflow-hidden rounded-3xl border-2 border-ink/10 bg-white">
        <div className="aspect-[4/5] w-full max-h-[420px] bg-cream" />
        <div className="space-y-2.5 p-4">
          <SkeletonLine className="h-5 w-1/2" />
          <SkeletonLine className="h-3.5 w-2/3" />
          <SkeletonLine className="h-3.5 w-full" />
        </div>
      </div>
    </main>
  );
}
