// Human-readable time helpers for the Chats list and message timestamps.
import { format, isToday, isTomorrow, isYesterday, differenceInCalendarDays } from "date-fns";

// Chat-list timestamp: "10:52 PM" today, "Tue 10:52 PM" this week, "Jun 25" older.
export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE h:mm a");
  return format(d, "MMM d");
}

// Compact "when" used as fallback context: "Today 11am" / "Sat 11am".
export function formatVibeShort(iso: string): string {
  const d = new Date(iso);
  const t = format(d, "h:mmaaa").toLowerCase().replace(":00", "");
  if (isToday(d)) return `Today ${t}`;
  if (isTomorrow(d)) return `Tomorrow ${t}`;
  return `${format(d, "EEE")} ${t}`;
}

// In-thread divider timestamp: "Today 3:24 PM" / "Yesterday 11:47 AM" / "Jun 18, 3:24 PM".
export function formatMessageDivider(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
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
