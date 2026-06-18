// Top-right social links (real Flockie handles).

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/find.flockie", icon: "instagram" },
  { label: "TikTok", href: "https://tiktok.com/@findflockie", icon: "tiktok" },
  { label: "X", href: "https://x.com/findflockie", icon: "x" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/findflockie/", icon: "linkedin" },
] as const;

function Icon({ name }: { name: string }) {
  const p = { width: 18, height: 18, "aria-hidden": true } as const;
  switch (name) {
    case "instagram":
      return (
        <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...p} viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 3c.3 2.1 1.6 3.7 3.5 4v2.4a6.7 6.7 0 0 1-3.5-1v5.8a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.5a3.1 3.1 0 1 0 2.2 3V3h2.5z" />
        </svg>
      );
    case "x":
      return (
        <svg {...p} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    default:
      return (
        <svg {...p} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05 4.02 0 4.76 2.65 4.76 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.07 1.4-2.07 2.85V21H9z" />
        </svg>
      );
  }
}

export default function SocialIcons({ dark = false }: { dark?: boolean }) {
  const cls = dark
    ? "flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/30 text-white hover:bg-white hover:text-ink transition-colors"
    : "flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-ink";
  return (
    <div className="flex items-center gap-2">
      {SOCIALS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          className={cls}
        >
          <Icon name={s.icon} />
        </a>
      ))}
    </div>
  );
}
