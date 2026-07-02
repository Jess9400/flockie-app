"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Compass, Map, Sparkles, MessageCircle, User, Bell, Menu, X, Ticket, Tag, Settings,
} from "lucide-react";
import Footer from "@/components/Footer";
import SignOutButton from "@/components/SignOutButton";
import { FeedbackProvider } from "@/components/ui/feedback";
import { createClient } from "@/lib/supabase/client";

// Explicit route → section mapping so child routes highlight their section
// (e.g. /buddies/* highlights Chats, /flocks/* highlights Match, /my-activities
// highlights My Trips). Keyed off the first path segment.
function sectionFor(pathname: string): string {
  const seg = "/" + (pathname.split("/")[1] ?? "");
  switch (seg) {
    case "/home":
      return "home";
    case "/vibes":
      return "vibes";
    case "/my-vibes":
      return "my-vibes";
    case "/match":
    case "/flocks":
      return "match";
    case "/my-trips":
    case "/my-activities":
      return "trips";
    case "/deals":
      return "deals";
    case "/chats":
    case "/buddies":
      return "chats";
    case "/inbox":
      return "inbox";
    case "/settings":
      return "settings";
    case "/profile":
      return "profile";
    default:
      return "";
  }
}

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  sections: string[];
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, sections: ["home"] },
  { href: "/vibes", label: "Vibes", icon: Sparkles, sections: ["vibes"] },
  { href: "/match", label: "Find a Buddy", icon: Compass, sections: ["match"] },
  { href: "/my-trips", label: "My Trips", icon: Map, sections: ["trips"] },
  { href: "/chats", label: "Chats", icon: MessageCircle, sections: ["chats"] },
];

// Secondary destinations live in the drawer/sidebar only (not the tab bar).
const SECONDARY_NAV: NavItem[] = [
  { href: "/my-vibes", label: "My Vibes", icon: Ticket, sections: ["my-vibes"] },
  { href: "/deals", label: "Deals", icon: Tag, sections: ["deals"] },
  { href: "/inbox", label: "Inbox", icon: Bell, sections: ["inbox"] },
  { href: "/settings", label: "Settings", icon: Settings, sections: ["settings"] },
];

// Mobile bottom tab bar: the 5 core surfaces, thumb-reachable. Tabs claim the
// sections of their children so e.g. /my-vibes lights up Vibes.
const TABS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, sections: ["home"] },
  { href: "/vibes", label: "Vibes", icon: Sparkles, sections: ["vibes", "my-vibes"] },
  { href: "/match", label: "Match", icon: Compass, sections: ["match"] },
  { href: "/chats", label: "Chats", icon: MessageCircle, sections: ["chats"] },
  { href: "/profile", label: "Profile", icon: User, sections: ["profile", "settings"] },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  // Chat rooms fill the viewport exactly (no page scroll, no footer) so the
  // chat window stays static and only the message list scrolls inside it.
  const isChatRoom =
    /^\/vibes\/[^/]+\/chat$/.test(pathname) || /^\/buddies\/[^/]+$/.test(pathname);
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
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null)
          .is("dismissed_at", null),
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

  function navItemCls(active: boolean) {
    return `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors ${
      active ? "bg-flockie-blue text-white" : "text-ink hover:bg-navy/5"
    }`;
  }

  const NavList = (
    <nav className="flex h-full flex-col gap-1">
      {PRIMARY_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={navItemCls(item.sections.includes(section))}
          >
            <Icon size={18} />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
      <div className="my-2 border-t-2 border-navy/10" />
      {SECONDARY_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={navItemCls(item.sections.includes(section))}
          >
            <Icon size={18} />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
      <div className="my-2 border-t-2 border-navy/10" />
      <Link href="/profile" onClick={() => setOpen(false)} className={navItemCls(section === "profile")}>
        <User size={18} /> <span className="flex-1">Profile</span>
      </Link>
    </nav>
  );

  return (
    <FeedbackProvider>
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
          <span className="rounded-full bg-flockie-coral px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
            Beta
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inbox"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-flockie-coral px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
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
      <div
        className={`flex flex-col pt-16 lg:pl-[200px] ${
          isChatRoom
            ? "h-[100dvh] overflow-hidden"
            : "min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0"
        }`}
      >
        <div className={`w-full flex-1 ${isChatRoom ? "min-h-0" : "mx-auto max-w-4xl"}`}>
          {children}
        </div>
        {!isChatRoom && <Footer />}
      </div>

      {/* Bottom tab bar (mobile only). Hidden in chat rooms so the composer
          keeps the bottom edge, and hidden at sm+ where the drawer/sidebar
          layout stays. */}
      {!isChatRoom && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <div className="grid grid-cols-5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.sections.includes(section);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-extrabold ${
                    active ? "text-flockie-coral" : "text-ink/60"
                  }`}
                >
                  <span className="relative">
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                    {tab.href === "/chats" && unread > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-flockie-coral px-0.5 text-[9px] font-bold leading-none text-white">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </span>
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
    </FeedbackProvider>
  );
}
