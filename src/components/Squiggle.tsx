// Hand-drawn squiggle underline for section headings — personality without
// weight. Inline SVG so it inherits nothing and weighs nothing.
export default function Squiggle({
  color = "#FF6B4A",
  width = 96,
  className = "",
}: {
  color?: string;
  width?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 10"
      width={width}
      height={Math.round((width / 120) * 10)}
      className={`mt-1 block ${className}`}
      aria-hidden="true"
    >
      <path
        d="M3 6.5 Q 13 1.5, 23 5.5 T 43 5.5 T 63 5.5 T 83 5.5 T 103 5.5 T 117 5"
        stroke={color}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
