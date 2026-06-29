// Minimal Resend sender (direct REST call — no SDK dependency). All Flockie
// transactional email goes through here. From address is fixed to the verified
// findflockie.com sender.
const FROM = "Flockie <hello@findflockie.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; skipped?: string; id?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Fail soft in environments without the key (local/preview) — never throw.
    console.warn("[email] RESEND_API_KEY not set — skipping send to", to);
    return { sent: false, skipped: "no-key" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: data.id };
}
