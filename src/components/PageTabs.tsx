"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Secondary in-page tab bar - used to nest one section inside another (e.g. My
// Vibes inside Vibes, Deals inside My Plans) without a top-level nav entry.
// A tab flagged `soon` renders disabled with a "Soon" badge (feature parked).
export default function PageTabs({
  tabs,
}: {
  tabs: { href: string; label: string; soon?: boolean }[];
}) {
  const pathname = usePathname();
  const t = useTranslations("common");
  return (
    <div className="mb-4 inline-flex gap-1 rounded-full border border-ink/15 p-1 text-sm font-bold">
      {tabs.map((tab) => {
        if (tab.soon) {
          return (
            <span
              key={tab.href}
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-4 py-1.5 text-ink/35"
            >
              {tab.label}
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-ink/40">
                {t("soon")}
              </span>
            </span>
          );
        }
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-1.5 transition-colors ${active ? "bg-flockie-coral text-white" : "text-ink/55 hover:text-ink"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
