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

// Tier-1 transactional types + their CTA label. Add Tier-2/3 here later.
const EMAILABLE: Record<string, string> = {
  vibe_invitation: "Confirm your spot",
  vibe_confirmed: "Open the chat",
  buddy_match: "Say hi",
  flock_approved: "Open My Trips",
  vibe_cancelled: "See details",
  vibe_private_request: "View the Vibe",
};

function linkFor(n: NotifRecord): string {
  const d = (n.data ?? {}) as Record<string, string | undefined>;
  if (n.type === "vibe_confirmed" && d.vibe_id) return `${SITE}/vibes/${d.vibe_id}/chat`;
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
