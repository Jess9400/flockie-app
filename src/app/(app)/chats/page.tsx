import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import ChatList from "@/components/ChatList";

// Chats landing.
//  - Mobile: the full unified conversation list (tap a row → full-screen thread).
//  - Desktop: the list lives in the persistent rail (AppShell); this pane shows
//    the "pick a conversation" placeholder until a thread is opened.
export default async function ChatsPage() {
  const t = await getTranslations("buddies");

  return (
    <>
      {/* Mobile: full list */}
      <main className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6 lg:hidden">
        <ChatList variant="page" />
      </main>

      {/* Desktop: empty right pane (rail carries the list) */}
      <div className="hidden h-full flex-col items-center justify-center px-8 text-center lg:flex">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-navy/15 bg-cream text-navy">
          <MessageCircle size={28} />
        </div>
        <p className="mt-4 font-fredoka text-lg font-semibold text-navy">{t("list.pickTitle")}</p>
        <p className="mt-1 max-w-xs font-nunito text-sm font-normal text-navy/60">{t("list.pickBody")}</p>
      </div>
    </>
  );
}
