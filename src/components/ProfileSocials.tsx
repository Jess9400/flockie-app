// Renders tappable icons for whichever social handles a profile has filled.

type Props = {
  instagram?: string | null;
  x_handle?: string | null;
  tiktok?: string | null;
  size?: number;
};

function clean(h: string) {
  return h.trim().replace(/^@+/, "").replace(/\s+/g, "");
}

const ICONS: Record<string, JSX.Element> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M16.5 3c.3 2.1 1.6 3.7 3.5 4v2.4a6.7 6.7 0 0 1-3.5-1v5.8a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.5a3.1 3.1 0 1 0 2.2 3V3h2.5z" />
    </svg>
  ),
};

export default function ProfileSocials({ instagram, x_handle, tiktok }: Props) {
  const links: { key: string; href: string; label: string }[] = [];
  if (instagram?.trim())
    links.push({ key: "instagram", href: `https://instagram.com/${clean(instagram)}`, label: "Instagram" });
  if (x_handle?.trim())
    links.push({ key: "x", href: `https://x.com/${clean(x_handle)}`, label: "X" });
  if (tiktok?.trim())
    links.push({ key: "tiktok", href: `https://tiktok.com/@${clean(tiktok)}`, label: "TikTok" });

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white text-ink hover:bg-flockie-orange hover:text-white hover:border-ink transition-colors"
        >
          {ICONS[l.key]}
        </a>
      ))}
    </div>
  );
}
