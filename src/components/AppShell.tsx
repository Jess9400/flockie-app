"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Compass, Map, Sparkles, CalendarCheck, MessageCircle, Tag, User, Bell, Menu, X,
} from "lucide-react";
import Footer from "@/components/Footer";
import LocationPrompt from "@/components/LocationPrompt";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/vibes", label: "Vibes", icon: Sparkles },
  { href: "/my-vibes", label: "My Vibes", icon: CalendarCheck },
  { href: "/match", label: "Find a match", icon: Compass },
  { href: "/my-trips", label: "My Trips", icon: Map },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/inbox", label: "Inbox", icon: Bell, badge: true },
  { href: "/deals", label: "Deals", icon: Tag },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ count }, { data: p }] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
        supabase.from("profiles").select("display_name, photos").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setUnread(count ?? 0);
      setName((p?.display_name ?? "").split(" ")[0]);
      setPhoto(p?.photos?.[0] ?? null);
    }
    load();
    const channel = supabase
      .channel("shell-notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [pathname]);

  function navItemCls(href: string) {
    const activeItem = pathname === href || pathname.startsWith(href + "/");
    return `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors ${
      activeItem ? "bg-flockie-blue text-white" : "text-ink hover:bg-navy/5"
    }`;
  }

  const NavList = (
    <nav className="flex h-full flex-col gap-1">
      <Link href="/home" onClick={() => setOpen(false)} className={navItemCls("/home")}>
        <Home size={18} /> <span className="flex-1">Home</span>
      </Link>
      <Link href="/vibes" onClick={() => setOpen(false)} className={navItemCls("/vibes")}>
        <Sparkles size={18} /> <span className="flex-1">Vibes</span>
      </Link>
      {NAV.filter((n) => !["/home", "/vibes"].includes(n.href)).map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={navItemCls(item.href)}>
            <Icon size={18} />
            <span className="flex-1">{item.label}</span>
            {item.badge && unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-flockie-coral px-1.5 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
        );
      })}
      <div className="my-2 border-t-2 border-navy/10" />
      <Link href="/profile" onClick={() => setOpen(false)} className={navItemCls("/profile")}>
        <User size={18} /> <span className="flex-1">Profile</span>
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b-2 border-ink bg-cream px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink lg:hidden">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link href="/home" aria-label="Flockie home">
            <Image src="/logo.svg" alt="Flockie" width={130} height={44} className="h-9 w-auto" priority />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/inbox" aria-label="Inbox" className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-navy/5">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-flockie-coral px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-full border-2 border-ink bg-white py-1 pl-1 pr-3">
              {photo ? (
                <Image src={photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-flockie-blue text-sm font-bold text-white">
                  {(name || "F")[0]}
                </span>
              )}
              <span className="hidden text-sm font-bold sm:inline">{name || "You"}</span>
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border-2 border-ink bg-white p-2 shadow-[0_4px_0_rgba(10,37,69,0.15)]">
                  <Link href="/profile" onClick={() => setMenu(false)} className="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-navy/5">
                    Profile
                  </Link>
                  <div className="mt-1 border-t-2 border-navy/10 pt-1">
                    <SignOutButton />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-[200px] border-r-2 border-ink bg-cream p-3 lg:block">
        {NavList}
      </aside>

      {/* Drawer (mobile/tablet) */}
      {open && (
        <>
          <div className="fixed inset-0 top-16 z-30 bg-navy/30 lg:hidden" onClick={() => setOpen(false)} />
          <aside className="fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r-2 border-ink bg-cream p-3 lg:hidden">
            {NavList}
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex min-h-screen flex-col pt-16 lg:pl-[200px]">
        <div className="mx-auto w-full max-w-4xl flex-1">{children}</div>
        <Footer />
      </div>

      <LocationPrompt />
    </div>
  );
}
