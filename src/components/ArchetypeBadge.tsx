import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import type { VibeDimension } from "@/lib/onboarding/types";

// Each archetype rendered as a unique CSS medallion (its own gradient ring)
// rather than a bare platform emoji — consistent across devices.
export default function ArchetypeBadge({
  archetypeKey,
  size = 40,
  variant = "gradient",
}: {
  archetypeKey: string;
  size?: number;
  variant?: "gradient" | "ring";
}) {
  const a = ARCHETYPES[archetypeKey as VibeDimension];
  if (!a) return null;
  const ring = variant === "ring";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: ring ? "rgba(255,255,255,0.18)" : `linear-gradient(135deg, ${a.gradientFrom}, ${a.gradientTo})`,
        border: ring ? "2px solid rgba(255,255,255,0.55)" : "none",
        boxShadow: ring ? "none" : "inset 0 2px 6px rgba(255,255,255,0.25)",
      }}
    >
      <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{a.emoji}</span>
    </span>
  );
}
