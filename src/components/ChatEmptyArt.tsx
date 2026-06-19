// Unique on-brand art for chat empty states (instead of generic emoji).
// "buddy" = two overlapping figures (1:1); "vibe" = a cluster (group).
export default function ChatEmptyArt({ variant }: { variant: "buddy" | "vibe" }) {
  if (variant === "buddy") {
    return (
      <svg width="76" height="56" viewBox="0 0 76 56" className="mx-auto" aria-hidden>
        <circle cx="28" cy="30" r="17" fill="#4DA8DA" stroke="#0A2545" strokeWidth="3" />
        <circle cx="50" cy="30" r="17" fill="#FF6B4A" stroke="#0A2545" strokeWidth="3" />
        <circle cx="23" cy="25" r="3" fill="#fff" />
        <circle cx="55" cy="25" r="3" fill="#fff" />
        <path d="M34 7 Q38 2 42 7" fill="none" stroke="#0A2545" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="84" height="56" viewBox="0 0 84 56" className="mx-auto" aria-hidden>
      <circle cx="24" cy="34" r="15" fill="#4DA8DA" stroke="#0A2545" strokeWidth="3" />
      <circle cx="60" cy="34" r="15" fill="#0A2545" stroke="#0A2545" strokeWidth="3" />
      <circle cx="42" cy="24" r="16" fill="#FF6B4A" stroke="#0A2545" strokeWidth="3" />
      <circle cx="42" cy="19" r="3" fill="#fff" />
      <circle cx="19" cy="30" r="2.5" fill="#fff" />
      <circle cx="65" cy="30" r="2.5" fill="#fff" />
    </svg>
  );
}
