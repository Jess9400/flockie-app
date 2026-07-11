// Maps an in-app notification (the row inserted by notify()) to a Tier-1
// transactional email, rendered in the RECIPIENT's persisted language
// (profiles.locale). The in-app notification's title/body stay English —
// only the EMAIL output is localized here.
//
// i18n conventions (must hold across every locale):
//   • Brand terms stay English: Flockie, Vibe(s), Flock(s), Find a Buddy,
//     buddy, match, vibe check.
//   • pt-BR: "Vibe/Vibes" is FEMININE ("a Vibe", "sua Vibe"); use "você"/"para"
//     (never "pra").
//   • es: neutral second person ("tú").
// The email subject/heading/body/CTA come from EMAIL_TEMPLATES (never from the
// English record.title/record.body). record.data still drives links + params.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://app.findflockie.com";

export type NotifRecord = {
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
};

export const EMAIL_LOCALES = ["en", "es", "pt"] as const;
export type Locale = (typeof EMAIL_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

function normalizeLocale(locale: string | null | undefined): Locale {
  return (EMAIL_LOCALES as readonly string[]).includes(locale ?? "")
    ? (locale as Locale)
    : DEFAULT_LOCALE;
}

type Template = { subject: string; heading: string; body: string; cta: string };
type NotifType =
  | "vibe_invitation"
  | "vibe_confirmed"
  | "buddy_match"
  | "flock_approved"
  | "vibe_cancelled"
  | "vibe_private_request"
  | "vibe_review_reminder"
  | "buddy_review_reminder"
  | "vibe_review_ready"
  | "vibe_starting_soon"
  | "vibe_final_reminder"
  | "unread_messages"
  | "weekly_digest"
  | "vibe_recommendation"
  | "vibe_shortlisted";

// Per-notification-type, per-locale copy. Bodies are intentionally generic:
// the specific Vibe/Flock title lives in the English record.title (not in
// record.data), so localized bodies don't echo it. Where record.data carries a
// param (weekly_digest.count), a {count} placeholder is interpolated below.
const EMAIL_TEMPLATES: Record<NotifType, Record<Locale, Template>> = {
  vibe_invitation: {
    en: {
      subject: "You're invited to a Vibe",
      heading: "You're invited to a Vibe",
      body: "A spot has your name on it. Confirm to lock it in before it fills up.",
      cta: "Confirm your spot",
    },
    es: {
      subject: "Tienes una invitación a una Vibe",
      heading: "Tienes una invitación a una Vibe",
      body: "Hay un lugar con tu nombre. Confírmalo para asegurarlo antes de que se llene.",
      cta: "Confirmar mi lugar",
    },
    pt: {
      subject: "Você foi convidado para uma Vibe",
      heading: "Você foi convidado para uma Vibe",
      body: "Tem uma vaga com o seu nome. Confirme para garantir antes que ela lote.",
      cta: "Confirmar minha vaga",
    },
  },
  vibe_confirmed: {
    en: {
      subject: "You're confirmed 🎉",
      heading: "You're in!",
      body: "Your spot for {title} on {when} is confirmed. Where: {location}. Open the chat to meet the group and see what to bring.",
      cta: "Open the chat",
    },
    es: {
      subject: "Estás confirmado 🎉",
      heading: "¡Estás dentro!",
      body: "Tu lugar para {title} el {when} está confirmado. Dónde: {location}. Abre el chat para conocer al grupo y ver qué llevar.",
      cta: "Abrir el chat",
    },
    pt: {
      subject: "Você está confirmado 🎉",
      heading: "Você está dentro!",
      body: "Sua vaga para {title} em {when} está confirmada. Onde: {location}. Abra o chat para conhecer o grupo e ver o que levar.",
      cta: "Abrir o chat",
    },
  },
  buddy_match: {
    en: {
      subject: "It's a match!",
      heading: "It's a match! 🎉",
      body: "You both liked each other. Say hi and start planning something together.",
      cta: "Say hi",
    },
    es: {
      subject: "¡Es un match!",
      heading: "¡Es un match! 🎉",
      body: "Se gustaron los dos. Salúdalo y empiecen a planear algo juntos.",
      cta: "Saludar",
    },
    pt: {
      subject: "Deu match!",
      heading: "Deu match! 🎉",
      body: "Vocês dois se curtiram. Mande um oi e comecem a planejar algo juntos.",
      cta: "Mandar um oi",
    },
  },
  flock_approved: {
    en: {
      subject: "You're in the Flock",
      heading: "You're in!",
      body: "You've been approved to join the Flock. Open the chat to meet everyone.",
      cta: "Open the Flock chat",
    },
    es: {
      subject: "Estás en el Flock",
      heading: "¡Estás dentro!",
      body: "Te aprobaron para unirte al Flock. Abre el chat para conocer a todos.",
      cta: "Abrir el chat del Flock",
    },
    pt: {
      subject: "Você entrou no Flock",
      heading: "Você está dentro!",
      body: "Você foi aprovado para entrar no Flock. Abra o chat para conhecer todo mundo.",
      cta: "Abrir o chat do Flock",
    },
  },
  vibe_cancelled: {
    en: {
      subject: "A Vibe was cancelled",
      heading: "A Vibe was cancelled",
      body: "One of your Vibes was called off. Open it for the details — and find another to jump into.",
      cta: "See details",
    },
    es: {
      subject: "Se canceló una Vibe",
      heading: "Se canceló una Vibe",
      body: "Se canceló una de tus Vibes. Ábrela para ver los detalles — y encuentra otra a la que sumarte.",
      cta: "Ver detalles",
    },
    pt: {
      subject: "Uma Vibe foi cancelada",
      heading: "Uma Vibe foi cancelada",
      body: "Uma das suas Vibes foi cancelada. Abra para ver os detalhes — e encontre outra para participar.",
      cta: "Ver detalhes",
    },
  },
  vibe_private_request: {
    en: {
      subject: "Someone used your invite link",
      heading: "Someone wants in",
      body: "Someone used your invite link for a Vibe. Take a look and let them in.",
      cta: "View the Vibe",
    },
    es: {
      subject: "Alguien usó tu enlace de invitación",
      heading: "Alguien quiere sumarse",
      body: "Alguien usó tu enlace de invitación para una Vibe. Échale un vistazo y déjalo entrar.",
      cta: "Ver la Vibe",
    },
    pt: {
      subject: "Alguém usou seu link de convite",
      heading: "Alguém quer participar",
      body: "Alguém usou seu link de convite para uma Vibe. Dê uma olhada e deixe a pessoa entrar.",
      cta: "Ver a Vibe",
    },
  },
  vibe_review_reminder: {
    en: {
      subject: "How was your Vibe?",
      heading: "How was your Vibe?",
      body: "Leave a quick review of the Vibe you went to — it helps the whole community.",
      cta: "Leave a review",
    },
    es: {
      subject: "¿Qué tal tu Vibe?",
      heading: "¿Qué tal tu Vibe?",
      body: "Deja una reseña rápida de la Vibe a la que fuiste — ayuda a toda la comunidad.",
      cta: "Dejar una reseña",
    },
    pt: {
      subject: "Como foi sua Vibe?",
      heading: "Como foi sua Vibe?",
      body: "Deixe uma avaliação rápida da Vibe que você foi — isso ajuda toda a comunidade.",
      cta: "Deixar avaliação",
    },
  },
  buddy_review_reminder: {
    en: {
      subject: "Rate the people you went with",
      heading: "How did it go?",
      body: "Rate the people you flocked with. Your feedback keeps Flockie a place people trust.",
      cta: "Rate your buddies",
    },
    es: {
      subject: "Califica a las personas con quienes fuiste",
      heading: "¿Cómo te fue?",
      body: "Califica a las personas con quienes fuiste. Tus comentarios mantienen a Flockie un lugar de confianza.",
      cta: "Calificar a tus buddies",
    },
    pt: {
      subject: "Avalie as pessoas com quem você foi",
      heading: "Como foi?",
      body: "Avalie as pessoas com quem você foi. Seu feedback mantém o Flockie um lugar de confiança.",
      cta: "Avaliar seus buddies",
    },
  },
  vibe_review_ready: {
    en: {
      subject: "Your matched list is ready",
      heading: "Your matches are ready",
      body: "The shortlist for your Vibe is ready to review. Pick who's coming along.",
      cta: "Review your matches",
    },
    es: {
      subject: "Tu lista de matches está lista",
      heading: "Tus matches están listos",
      body: "La lista para tu Vibe está lista para revisar. Elige quién se suma.",
      cta: "Revisar mis matches",
    },
    pt: {
      subject: "Sua lista de matches está pronta",
      heading: "Seus matches estão prontos",
      body: "A lista da sua Vibe está pronta para revisar. Escolha quem vai junto.",
      cta: "Revisar meus matches",
    },
  },
  vibe_starting_soon: {
    en: {
      subject: "Your Vibe is tomorrow",
      heading: "Your Vibe is tomorrow",
      body: "It kicks off soon — open the chat to coordinate with your group.",
      cta: "Open the chat",
    },
    es: {
      subject: "Tu Vibe es mañana",
      heading: "Tu Vibe es mañana",
      body: "Empieza pronto — abre el chat para coordinar con tu grupo.",
      cta: "Abrir el chat",
    },
    pt: {
      subject: "Sua Vibe é amanhã",
      heading: "Sua Vibe é amanhã",
      body: "Começa em breve — abra o chat para combinar com o seu grupo.",
      cta: "Abrir o chat",
    },
  },
  vibe_final_reminder: {
    en: {
      subject: "Your Vibe starts soon 📍",
      heading: "Almost time!",
      body: "{title} starts {when}. Where to go: {location}. Tap the map for directions, and open the chat to coordinate with your group.",
      cta: "Open the chat",
    },
    es: {
      subject: "Tu Vibe empieza pronto 📍",
      heading: "¡Ya casi es hora!",
      body: "{title} empieza {when}. Dónde ir: {location}. Toca el mapa para las indicaciones y abre el chat para coordinar con tu grupo.",
      cta: "Abrir el chat",
    },
    pt: {
      subject: "Sua Vibe começa em breve 📍",
      heading: "Está quase na hora!",
      body: "{title} começa {when}. Onde ir: {location}. Toque no mapa para ver como chegar e abra o chat para combinar com o seu grupo.",
      cta: "Abrir o chat",
    },
  },
  unread_messages: {
    en: {
      subject: "You have new messages",
      heading: "You have new messages",
      body: "There are new messages waiting for you — jump back in and keep the plan moving.",
      cta: "Open the chat",
    },
    es: {
      subject: "Tienes mensajes nuevos",
      heading: "Tienes mensajes nuevos",
      body: "Tienes mensajes nuevos esperándote — vuelve y sigue con el plan.",
      cta: "Abrir el chat",
    },
    pt: {
      subject: "Você tem mensagens novas",
      heading: "Você tem mensagens novas",
      body: "Tem mensagens novas esperando por você — volte e siga com o plano.",
      cta: "Abrir o chat",
    },
  },
  weekly_digest: {
    en: {
      subject: "Vibes near you this week",
      heading: "Vibes near you this week",
      body: "{count} new Vibes were picked for you this week. Take a look and find your next plan.",
      cta: "Browse Vibes",
    },
    es: {
      subject: "Vibes cerca de ti esta semana",
      heading: "Vibes cerca de ti esta semana",
      body: "Elegimos {count} Vibes nuevas para ti esta semana. Échales un vistazo y encuentra tu próximo plan.",
      cta: "Explorar Vibes",
    },
    pt: {
      subject: "Vibes perto de você esta semana",
      heading: "Vibes perto de você esta semana",
      body: "Selecionamos {count} Vibes novas para você esta semana. Dê uma olhada e encontre seu próximo plano.",
      cta: "Explorar Vibes",
    },
  },
  vibe_recommendation: {
    en: {
      subject: "A Vibe you might love",
      heading: "A Vibe near you",
      body: "We found a Vibe in your city that matches your vibe. Take a look — and join if it's your thing.",
      cta: "Check it out",
    },
    es: {
      subject: "Una Vibe que te puede gustar",
      heading: "Una Vibe cerca de ti",
      body: "Encontramos una Vibe en tu ciudad que encaja contigo. Échale un vistazo — y únete si es lo tuyo.",
      cta: "Verla",
    },
    pt: {
      subject: "Uma Vibe que você pode curtir",
      heading: "Uma Vibe perto de você",
      body: "Encontramos uma Vibe na sua cidade que combina com você. Dê uma olhada — e entre se for a sua vibe.",
      cta: "Ver a Vibe",
    },
  },
  vibe_shortlisted: {
    en: {
      subject: "You're in the running",
      heading: "You're in the running",
      body: "You're in the running for a Vibe. We'll confirm your spot soon — keep an eye out.",
      cta: "See the Vibe",
    },
    es: {
      subject: "Estás en la lista",
      heading: "Estás en la lista",
      body: "Estás en la lista para una Vibe. Pronto confirmamos tu lugar — mantente atento.",
      cta: "Ver la Vibe",
    },
    pt: {
      subject: "Você está concorrendo a uma vaga",
      heading: "Você está concorrendo",
      body: "Você está concorrendo a uma vaga em uma Vibe. Em breve confirmamos a sua vaga — fique de olho.",
      cta: "Ver a Vibe",
    },
  },
};

// Email chrome (greeting + footer note + unsubscribe label), per locale.
const CHROME: Record<Locale, { greeting: string; why: string; unsubscribe: string; map: string }> = {
  en: {
    greeting: "Hey there,",
    why: "You're getting this because of activity on your Flockie account.",
    unsubscribe: "Unsubscribe from these emails",
    map: "📍 Open in Google Maps",
  },
  es: {
    greeting: "Hola,",
    why: "Recibes este correo por la actividad en tu cuenta de Flockie.",
    unsubscribe: "Darte de baja de estos correos",
    map: "📍 Abrir en Google Maps",
  },
  pt: {
    greeting: "Oi,",
    why: "Você está recebendo este e-mail por causa da atividade na sua conta do Flockie.",
    unsubscribe: "Cancelar o recebimento destes e-mails",
    map: "📍 Abrir no Google Maps",
  },
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
  // 6h "final reminder" → the vibe chat.
  if (n.type === "vibe_final_reminder" && d.vibe_id) return `${SITE}/vibes/${d.vibe_id}/chat`;
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

// Fill {count} (and future {name}) placeholders from record.data. Params with no
// value fall back to a neutral token so a template never renders a raw "{count}".
function interpolate(text: string, data: Record<string, unknown> | null): string {
  const d = (data ?? {}) as Record<string, unknown>;
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = d[key];
    if (v === null || v === undefined) return key === "count" ? "New" : "";
    return String(v);
  });
}

function layout(opts: {
  heading: string;
  body: string;
  cta: string;
  url: string;
  unsubUrl: string;
  chrome: { greeting: string; why: string; unsubscribe: string; map: string };
  mapUrl?: string;
}): string {
  const { heading, body, cta, url, unsubUrl, chrome, mapUrl } = opts;
  const mapLine = mapUrl
    ? `<p style="margin:16px 0 0;font-size:14px;"><a href="${mapUrl}" style="color:#0A2545;font-weight:600;text-decoration:underline;">${escapeHtml(chrome.map)}</a></p>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;background:#f4efe6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:8px 0 20px;font-size:22px;font-weight:800;color:#0A2545;">Flockie</div>
    <div style="background:#fff;border:2px solid #0A2545;border-radius:20px;padding:24px;">
      <p style="margin:0 0 12px;font-size:14px;color:#888;">${escapeHtml(chrome.greeting)}</p>
      <h1 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#444;">${escapeHtml(body)}</p>
      <a href="${url}" style="display:inline-block;background:#FF6B4A;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;border:2px solid #0A2545;">${escapeHtml(cta)} →</a>
      ${mapLine}
    </div>
    <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#888;">
      ${escapeHtml(chrome.why)}<br/>
      <a href="${unsubUrl}" style="color:#888;">${escapeHtml(chrome.unsubscribe)}</a>
    </p>
  </div>
</body></html>`;
}

// Renders the email in the RECIPIENT's locale. Falls back to English for an
// unknown locale, and returns null for notification types we don't email.
export function buildEmail(
  n: NotifRecord,
  unsubUrl: string,
  locale: string | null | undefined = DEFAULT_LOCALE
): { subject: string; html: string } | null {
  const byLocale = EMAIL_TEMPLATES[n.type as NotifType];
  if (!byLocale) return null;

  const loc = normalizeLocale(locale);
  // Fall back to English if a specific locale entry is somehow missing.
  const tpl = byLocale[loc] ?? byLocale[DEFAULT_LOCALE];
  const chrome = CHROME[loc] ?? CHROME[DEFAULT_LOCALE];

  const body = interpolate(tpl.body, n.data);
  const d = (n.data ?? {}) as Record<string, unknown>;
  const mapUrl = typeof d.mapUrl === "string" ? d.mapUrl : undefined;
  return {
    subject: tpl.subject,
    html: layout({
      heading: tpl.heading,
      body,
      cta: tpl.cta,
      url: linkFor(n),
      unsubUrl,
      chrome,
      mapUrl,
    }),
  };
}
