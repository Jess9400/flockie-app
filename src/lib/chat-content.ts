// Helpers for rendering message content (links + images).

const IMG_RE = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;
const URL_RE = /(https?:\/\/[^\s]+)/i;

export function isImageUrl(text: string): boolean {
  const t = text.trim();
  if (/\s/.test(t)) return false; // a message with text + url isn't a pure image
  return IMG_RE.test(t) || t.includes("/storage/v1/object/public/");
}

export function firstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[1] : null;
}
