import { Star } from "lucide-react";

// Read-only star row based on a 0-5 rating (rounds to nearest whole star).
export default function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= rounded ? "fill-flockie-coral text-flockie-coral" : "text-navy/25"}
        />
      ))}
    </span>
  );
}
