// Maps an in-app notification (the row inserted by notify()) to a Tier-1
// transactional email. Returns null for notification types we don't email.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://app.findflockie.com";

export type NotifRecord = {
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
};

// Tier-1 transactional types + their CTA label.
// Tier-2 retention + Tier-3 digest types are added below.
const EMAILABLE: Record<string, string> = {
  // ── Tier-1: transactional ────────────────────────────────────────────────
  vibe_invitation: "Confirm your spot",
  vibe_confirmed: "Open the chat",
  buddy_match: "Say hi",
  flock_approved: "Open the Flock chat",
  vibe_cancelled: "See details",
  vibe_private_request: "View the Vibe",
  // ── Tier-2: retention (review reminders, event + message nudges) ──────────
  vibe_review_reminder: "Leave a review",   // review the event you attended
  buddy_review_reminder: "Rate your buddies", // review the people you went with
  vibe_review_ready: "Review your matches", // host: shortlist is ready to review
  vibe_starting_soon: "Open the chat",       // your Vibe is tomorrow
  unread_messages: "Open the chat",          // new messages while you were away
  // ── Tier-3: opt-outable digest ───────────────────────────────────────────
  weekly_digest: "Browse Vibes",             // weekly "Vibes near you"
};

function linkFor(n: NotifRecord): string {
  const d = (n.data ?? {}) as Record<string, string | undefined>;
  // Crons set an exact relative `href` in the notification payload (review
  // reminders, unread-message nudges). Trust it when present so a new surface
  // never needs a code change here.
  if (typeof d.href === "string" && d.href.startsWith("/")) return `${SITE}${d.href}`;
  if (n.type === "vibe_confirmed" && d.vibe_id) return `${SITE}/vibes/${d.vibe_id}/chat`;
  // "Your Vibe is tomorrow" → the vibe chat to coordinate.
  if (n.type === "vibe_starting_soon" && d.vibe_id) return `${SITE}/vibes/${d.vibe_id}/chat`;
  // Weekly digest → the Vibes browse page.
  if (n.type === "weekly_digest") return `${SITE}/vibes`;
  // Approved flock member → the flock chat (/my-trips only lists trips they host).
  if (n.type === "flock_approved") return d.chat_id ? `${SITE}/buddies/${d.chat_id}` : `${SITE}/chats`;
  if (d.vibe_id) return `${SITE}/vibes/${d.vibe_id}`;
  if (d.trip_id) return `${SITE}/my-trips#trip-${d.trip_id}`;
  if (d.chat_id) return `${SITE}/buddies/${d.chat_id}`;
  if (d.like_from) return `${SITE}/people/${d.like_from}`;
  return `${SITE}/home`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function layout(opts: { title: string; body: string; cta: string; url: string; unsubUrl: string }): string {
  const { title, body, cta, url, unsubUrl } = opts;
  return `<!doctype html>
<html><body style="margin:0;background:#f4efe6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:8px 0 20px;font-size:22px;font-weight:800;color:#0A2545;">Flockie</div>
    <div style="background:#fff;border:2px solid #0A2545;border-radius:20px;padding:24px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#444;">${escapeHtml(body)}</p>
      <a href="${url}" style="display:inline-block;background:#FF6B4A;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;border:2px solid #0A2545;">${escapeHtml(cta)} →</a>
    </div>
    <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#888;">
      You're getting this because of activity on your Flockie account.<br/>
      <a href="${unsubUrl}" style="color:#888;">Unsubscribe from these emails</a>
    </p>
  </div>
</body></html>`;
}

export function buildEmail(n: NotifRecord, unsubUrl: string): { subject: string; html: string } | null {
  const cta = EMAILABLE[n.type];
  if (!cta) return null;
  return {
    subject: n.title,
    html: layout({ title: n.title, body: n.body ?? "", cta, url: linkFor(n), unsubUrl }),
  };
}
