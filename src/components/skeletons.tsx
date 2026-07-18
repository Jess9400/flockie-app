// Loading-state primitives for route-level loading.tsx files.
// Styled to the design system (ink borders softened to ink/10, cream/white
// surfaces, rounded-2xl/3xl) — no data, no client JS.

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-ink/10 ${className}`} />;
}

// Square-artwork "trading card" — mirrors VibeCard / flock cards.
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-ink/10 bg-white">
      <div className="aspect-square w-full animate-pulse border-b-2 border-ink/10 bg-cream" />
      <div className="space-y-2 p-2.5">
        <SkeletonLine className="h-3 w-5/6" />
        <SkeletonLine className="h-2.5 w-1/2" />
        <SkeletonLine className="h-2.5 w-2/3" />
      </div>
    </div>
  );
}

// Compact list row — mirrors chat rows / My Vibes / My Trips rows.
export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white p-3">
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-cream" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine className="h-3 w-2/3" />
        <SkeletonLine className="h-2.5 w-1/2" />
      </div>
      <SkeletonLine className="h-5 w-14 shrink-0" />
    </div>
  );
}

// Horizontal browse-card row — mirrors the Vibes list without changing other list loaders.
export function SkeletonVibeListCard() {
  return (
    <div className="flex min-h-28 overflow-hidden rounded-2xl border-2 border-ink/10 bg-white">
      <div className="w-24 shrink-0 animate-pulse border-r-2 border-ink/10 bg-cream sm:w-28" />
      <div className="flex flex-1 flex-col justify-center space-y-2 p-3 pr-16 sm:p-4 sm:pr-20">
        <SkeletonLine className="h-4 w-3/5" />
        <SkeletonLine className="h-3 w-2/5" />
        <SkeletonLine className="h-3 w-1/2" />
      </div>
    </div>
  );
}

// Horizontal snap carousel — mirrors the Home page card rails.
export function SkeletonCarousel({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden pb-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-56 shrink-0">
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}
