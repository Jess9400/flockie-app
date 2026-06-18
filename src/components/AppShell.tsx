"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Sparkles, Tag, User, Menu, X } from "lucide-react";
import SocialIcons from "@/components/SocialIcons";
import SignOutButton from "@/components/SignOutButton";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/match", label: "Find a match", icon: Compass },
  { href: "/vibes", label: "Create a Vibe", icon: Sparkles },
  { href: "/deals", label: "Deals", icon: Tag },
  { href: "/profile", label: "Profile", icon: User },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const NavList = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors ${
              active ? "bg-ink text-white" : "text-ink hover:bg-cream"
            }`}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b-2 border-ink bg-white px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink md:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link href="/home" aria-label="Flockie home">
            <Image src="/logo.svg" alt="Flockie" width={130} height={44} className="h-9 w-auto" priority />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <SocialIcons />
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-60 border-r-2 border-ink bg-white p-4 md:block">
        {NavList}
      </aside>

      {/* Drawer (mobile) */}
      {open && (
        <>
          <div
            className="fixed inset-0 top-16 z-30 bg-ink/30 md:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r-2 border-ink bg-white p-4 md:hidden">
            {NavList}
            <div className="mt-6 border-t-2 border-cream pt-4">
              <SocialIcons />
            </div>
          </aside>
        </>
      )}

      {/* Main */}
      <div className="pt-16 md:pl-60">
        <div className="mx-auto max-w-3xl pb-16">{children}</div>
      </div>
    </div>
  );
}
