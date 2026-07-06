// Human-readable time helpers for the Chats list and message timestamps.
import { format, isToday, isTomorrow, isYesterday, differenceInCalendarDays } from "date-fns";
import { dfLocale, relativeWords } from "@/lib/date-locale";

// Chat-list timestamp: "10:52 PM" today, "Tue 10:52 PM" this week, "Jun 25" older.
export function formatChatTime(iso: string, locale = "en"): string {
  const d = new Date(iso);
  const df = dfLocale(locale);
  if (isToday(d)) return format(d, "h:mm a", { locale: df });
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE h:mm a", { locale: df });
  return format(d, "MMM d", { locale: df });
}

// Compact "when" used as fallback context: "Today 11am" / "Sat 11am".
export function formatVibeShort(iso: string, locale = "en"): string {
  const d = new Date(iso);
  const df = dfLocale(locale);
  const rel = relativeWords(locale);
  const t = format(d, "h:mmaaa", { locale: df }).toLowerCase().replace(":00", "");
  if (isToday(d)) return `${rel.today} ${t}`;
  if (isTomorrow(d)) return `${rel.tomorrow} ${t}`;
  return `${format(d, "EEE", { locale: df })} ${t}`;
}

// In-thread divider timestamp: "Today 3:24 PM" / "Yesterday 11:47 AM" / "Jun 18, 3:24 PM".
export function formatMessageDivider(iso: string, locale = "en"): string {
  const d = new Date(iso);
  const df = dfLocale(locale);
  const rel = relativeWords(locale);
  if (isToday(d)) return `${rel.today} ${format(d, "h:mm a", { locale: df })}`;
  if (isYesterday(d)) return `${rel.yesterday} ${format(d, "h:mm a", { locale: df })}`;
  return format(d, "MMM d, h:mm a", { locale: df });
}

// Whether to render a timestamp divider before a message: first of thread,
// new day, or >30 min gap from the previous message.
export function needsDivider(prevIso: string | null, iso: string): boolean {
  if (!prevIso) return true;
  const prev = new Date(prevIso);
  const cur = new Date(iso);
  if (prev.toDateString() !== cur.toDateString()) return true;
  return cur.getTime() - prev.getTime() > 30 * 60 * 1000;
}
