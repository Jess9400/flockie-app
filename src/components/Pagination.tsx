import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Numbered pagination (1 2 3 …). Server component: `hrefFor` builds each page's
// URL while preserving the caller's other query params. Windowed so long lists
// stay short: 1 … 4 5 6 … 12.
export default function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (p: number) => string;
}) {
  if (totalPages <= 1) return null;

  const want = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const nums: (number | "ellipsis")[] = [];
  let prev = 0;
  for (let i = 1; i <= totalPages; i++) {
    if (!want.has(i)) continue;
    if (i - prev > 1) nums.push("ellipsis");
    nums.push(i);
    prev = i;
  }

  const cell =
    "flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-ink px-3 text-sm font-bold";

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={`${cell} bg-white`} aria-label="Previous page">
          <ChevronLeft size={16} />
        </Link>
      )}
      {nums.map((n, i) =>
        n === "ellipsis" ? (
          <span key={`e${i}`} className="px-1 text-sm font-bold text-muted">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${cell} ${n === page ? "bg-ink text-white" : "bg-white text-ink"}`}
          >
            {n}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className={`${cell} bg-white`} aria-label="Next page">
          <ChevronRight size={16} />
        </Link>
      )}
    </nav>
  );
}
