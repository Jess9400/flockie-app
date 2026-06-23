import Link from "next/link";
import Image from "next/image";

// Chat type → pill label + colors.
const KIND_TAG: Record<string, { label: string; cls: string }> = {
  travel_buddy: { label: "Travel Buddy", cls: "bg-flockie-blue/15 text-flockie-blue" },
  activity_buddy: { label: "Activity Buddy", cls: "bg-flockie-coral/15 text-flockie-coral" },
  flock: { label: "Flock", cls: "bg-onboarding-green/15 text-onboarding-green" },
  vibe: { label: "Vibes Buddy", cls: "bg-flockie-orange/15 text-flockie-orange" },
};

export default function ChatRow({
  href,
  photo,
  title,
  subtitle,
  time,
  unread,
  fallback,
  fallbackTone = "blue",
  kind,
}: {
  href: string;
  photo: string | null;
  title: string;
  subtitle: string;
  time: string;
  unread: number;
  fallback: string; // emoji or initial
  fallbackTone?: "blue" | "cream";
  kind?: string;
}) {
  const tag = kind ? KIND_TAG[kind] : undefined;
  return (
    <Link
      href={href}
      className="flex h-20 items-center gap-2 rounded-2xl border-2 border-navy bg-[#FCF9F4] px-2 transition-all hover:scale-[1.01] hover:shadow-[0_3px_10px_rgba(10,37,69,0.1)]"
    >
      {/* Photo */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
        {photo ? (
          <Image src={photo} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center text-xl font-bold ${
              fallbackTone === "blue" ? "bg-flockie-blue text-white" : "bg-cream text-navy"
            }`}
          >
            {fallback}
          </span>
        )}
      </div>

      {/* Middle */}
      <div className="min-w-0 flex-1 px-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-fredoka text-[17px] font-semibold text-navy">{title}</p>
          {tag && (
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-nunito text-[10px] font-extrabold ${tag.cls}`}>
              {tag.label}
            </span>
          )}
        </div>
        <p className="truncate font-nunito text-sm font-normal text-navy/70">{subtitle}</p>
      </div>

      {/* Right */}
      <div className="flex h-full w-16 shrink-0 flex-col items-end justify-center gap-1.5 pr-1">
        <span className="font-nunito text-xs font-normal text-navy/60">{time}</span>
        {unread > 0 &&
          (unread === 1 ? (
            <span className="h-2 w-2 rounded-full bg-flockie-coral" />
          ) : (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-flockie-coral px-1.5 font-nunito text-xs font-bold text-white">
              {unread}
            </span>
          ))}
      </div>
    </Link>
  );
}
