"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Compass, Map, Sparkles, MessageCircle, User, Bell, Menu, X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Footer from "@/components/Footer";
import SignOutButton from "@/components/SignOutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ChatList from "@/components/ChatList";
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
  // Key into the `nav` message namespace (resolved via useTranslations at render).
  labelKey: string;
  icon: typeof Home;
  sections: string[];
};

// The drawer/sidebar is deliberately kept to these 5 (+ Profile below). The
// nested surfaces are NOT nav rows: My Vibes is a tab inside Vibes, Deals a tab
// inside My Trips, Inbox is the top-right bell, Settings lives on the Profile
// page. `sections` therefore include the child tabs so the parent highlights
// on them (e.g. Vibes stays active on /my-vibes).
const PRIMARY_NAV: NavItem[] = [
  { href: "/home", labelKey: "home", icon: Home, sections: ["home"] },
  { href: "/vibes", labelKey: "vibes", icon: Sparkles, sections: ["vibes", "my-vibes"] },
  { href: "/match", labelKey: "findABuddy", icon: Compass, sections: ["match"] },
  // "My Plans" lands on Activities — Trips is parked "Soon", so it's not the entry.
  { href: "/my-activities", labelKey: "myTrips", icon: Map, sections: ["trips", "deals"] },
  { href: "/chats", labelKey: "chats", icon: MessageCircle, sections: ["chats"] },
];

// Mobile bottom tab bar. The 1st slot is the ☰ menu (opens the drawer with
// Home + everything); Profile lives on the top-right avatar, so the last tab
// is My Plans. Tabs claim their children's sections so e.g. /my-vibes lights
// up Vibes.
const TABS: NavItem[] = [
  { href: "/vibes", labelKey: "vibes", icon: Sparkles, sections: ["vibes", "my-vibes"] },
  { href: "/match", labelKey: "match", icon: Compass, sections: ["match"] },
  { href: "/chats", labelKey: "chats", icon: MessageCircle, sections: ["chats"] },
  { href: "/my-activities", labelKey: "myTrips", icon: Map, sections: ["trips", "deals"] },
];

export default function AppShell({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tc = useTranslations("components");
  const section = sectionFor(pathname);
  // Chat rooms fill the viewport exactly (no page scroll, no footer) so the
  // chat window stays static and only the message list scrolls inside it.
  const isChatRoom =
    /^\/vibes\/[^/]+\/chat$/.test(pathname) || /^\/buddies\/[^/]+$/.test(pathname);
  const isChatsList = pathname === "/chats" || pathname.startsWith("/chats/");
  // Any chat surface gets the persistent desktop rail (list on the left,
  // conversation/placeholder on the right).
  const inChatSurface = isChatRoom || isChatsList;
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    async function load() {
      const [{ count }, { data: p }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("read_at", null)
          .is("dismissed_at", null),
        supabase.from("profiles").select("display_name, photos").eq("id", userId).maybeSingle(),
      ]);
      if (!active) return;
      setUnread(count ?? 0);
      setName((p?.display_name ?? "").split(" ")[0]);
      setPhoto(p?.photos?.[0] ?? null);
    }
    load();
    // Listen for ALL changes to THIS user's notifications (insert = new, update =
    // read/dismiss so the badge drops live) — keyed on userId only, so it loads
    // once per session and the channel persists across navigation instead of
    // re-fetching + re-subscribing on every page click.
    const channel = supabase
      .channel("shell-notif")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [userId]);

  // Total unread chat messages — powers the Chats nav badge (sidebar + mobile
  // tab). Sourced from the same unified feed as the list so the count always
  // agrees with the rows. Refetched on navigation (so it drops after a thread
  // marks itself read) and on any new message.
  const loadChatUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/chats/list", { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as { unreadTotal?: number };
      setChatUnread(d.unreadTotal ?? 0);
    } catch {
      /* transient — keep last known count */
    }
  }, []);

  useEffect(() => {
    loadChatUnread();
  }, [loadChatUnread, pathname]);

  useEffect(() => {
    const supabase = createClient();
    try {
      const channel = supabase
        .channel("shell-chat-unread")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "vibing_messages" }, () => loadChatUnread())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "buddy_messages" }, () => loadChatUnread())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch {
      // Never let a realtime subscription error crash the shell (it wraps every
      // page). Badge still refreshes on navigation via the effect above.
      return;
    }
  }, [loadChatUnread]);

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
            <span className="flex-1">{t(item.labelKey)}</span>
            {item.href === "/chats" && chatUnread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-flockie-coral px-1.5 text-[11px] font-extrabold text-white">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </Link>
        );
      })}
      <div className="my-2 border-t-2 border-navy/10" />
      <Link href="/profile" onClick={() => setOpen(false)} className={navItemCls(section === "profile")}>
        <User size={18} /> <span className="flex-1">{t("profile")}</span>
      </Link>
    </nav>
  );

  return (
    <FeedbackProvider>
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-ink/12 bg-cream px-4 sm:px-6">
        <div className="flex items-center gap-2">
          {/* Top-left menu: mobile only in chat rooms (where the bottom bar is
              hidden); on desktop only on chat surfaces. Elsewhere the bottom
              tab bar's ☰ opens the drawer. */}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={tc("appShell.menu")}
            className={`h-9 w-9 items-center justify-center rounded-full border border-ink/15 ${
              isChatRoom ? "flex" : "hidden"
            } ${inChatSurface ? "lg:flex" : "lg:hidden"}`}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link href="/home" aria-label={tc("appShell.home")}>
            <Image src="/logo.svg" alt="Flockie" width={130} height={44} className="h-9 w-auto" priority />
          </Link>
          <span className="rounded-full bg-flockie-coral px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
            {tc("appShell.beta")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            href="/inbox"
            aria-label={tc("appShell.notifications")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-flockie-coral px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-full border border-ink/15 bg-white py-1 pl-1 pr-3">
              {photo ? (
                <Image src={photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-flockie-blue text-sm font-bold text-white">
                  {(name || "F")[0]}
                </span>
              )}
              <span className="hidden text-sm font-bold sm:inline">{name || tc("appShell.you")}</span>
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-ink/15 bg-white p-2 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
                  <Link href="/profile" onClick={() => setMenu(false)} className="block rounded-xl px-3 py-2 text-sm font-bold hover:bg-navy/5">
                    {tc("appShell.profile")}
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

      {/* Sidebar (desktop). Hidden on chat surfaces, where the nav collapses to
          the ☰ button to give the two chat panes room. */}
      <aside
        className={`fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-[200px] border-r border-ink/12 bg-cream p-3 ${
          inChatSurface ? "" : "lg:block"
        }`}
      >
        {NavList}
      </aside>

      {/* Drawer (mobile/tablet — and desktop on chat surfaces via ☰). */}
      {open && (
        <>
          <div
            className={`fixed inset-0 top-16 z-30 bg-navy/30 ${inChatSurface ? "" : "lg:hidden"}`}
            onClick={() => setOpen(false)}
          />
          <aside
            className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-ink/12 bg-cream p-3 ${
              inChatSurface ? "" : "lg:hidden"
            }`}
          >
            {NavList}
          </aside>
        </>
      )}

      {/* Main */}
      {inChatSurface ? (
        // Chat surfaces are a two-pane layout on desktop: a persistent
        // conversation-list rail on the left, the open thread (or a "pick a
        // conversation" placeholder) on the right. On mobile the rail is hidden
        // and the page renders full-width (list, or a full-screen thread).
        <div
          className={`flex pt-16 ${
            isChatRoom
              ? "h-[100dvh] overflow-hidden"
              : "min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0 lg:h-[100dvh] lg:overflow-hidden lg:pb-0"
          }`}
        >
          <aside className="hidden w-[320px] shrink-0 flex-col border-r border-ink/12 bg-cream lg:flex">
            <ChatList variant="rail" />
          </aside>
          <div className="min-h-0 min-w-0 flex-1">{children}</div>
        </div>
      ) : (
        <div className="flex min-h-screen flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-16 sm:pb-0 lg:pl-[200px]">
          <div className="mx-auto w-full max-w-4xl flex-1">{children}</div>
          <Footer />
        </div>
      )}

      {/* Bottom tab bar (mobile only). Hidden in chat rooms so the composer
          keeps the bottom edge, and hidden at sm+ where the drawer/sidebar
          layout stays. */}
      {!isChatRoom && (
        <nav
          aria-label={tc("appShell.primaryNav")}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/12 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <div className="grid grid-cols-5">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={tc("appShell.menu")}
              className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-extrabold ${
                open ? "text-flockie-coral" : "text-ink/60"
              }`}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
              {tc("appShell.menu")}
            </button>
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
                    {tab.href === "/chats" && chatUnread > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-flockie-coral px-0.5 text-[9px] font-bold leading-none text-white">
                        {chatUnread > 9 ? "9+" : chatUnread}
                      </span>
                    )}
                  </span>
                  {t(tab.labelKey)}
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
