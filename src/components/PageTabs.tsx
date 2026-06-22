"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Secondary in-page tab bar — used to nest one section inside another (e.g. My
// Vibes inside Vibes, Deals inside My Trips) without a top-level nav entry.
export default function PageTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="mb-4 inline-flex gap-1 rounded-full border-2 border-ink bg-white p-1 text-sm font-bold">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-4 py-1.5 transition-colors ${active ? "bg-ink text-white" : "text-ink hover:bg-navy/5"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
