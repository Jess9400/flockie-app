import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import SocialIcons from "@/components/SocialIcons";

export default function Footer() {
  const t = useTranslations("components");
  return (
    <footer className="mt-12 bg-ink text-white">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Image src="/logo-mark.svg" alt="Flockie" width={48} height={43} className="h-10 w-auto" />
            <p className="mt-3 text-2xl font-extrabold">{t("footer.tagline")}</p>
            <span className="mt-3 inline-block rounded-full bg-flockie-coral px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-[0_2px_0_0_rgba(0,0,0,0.2)]">
              {t("footer.beta")}
            </span>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <SocialIcons dark />
            <a
              href="mailto:hello@findflockie.com"
              className="font-medium text-white/80 hover:text-white"
            >
              hello@findflockie.com
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright")}</p>
          <div className="flex gap-4 font-bold">
            <Link href="/safety" className="hover:text-white">
              {t("footer.safety")}
            </Link>
            <Link href="/privacy" className="hover:text-white">
              {t("footer.privacy")}
            </Link>
            <Link href="/terms" className="hover:text-white">
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
