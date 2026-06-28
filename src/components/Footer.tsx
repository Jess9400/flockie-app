import Link from "next/link";
import Image from "next/image";
import SocialIcons from "@/components/SocialIcons";

export default function Footer() {
  return (
    <footer className="mt-12 bg-ink text-white">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Image src="/logo-mark.svg" alt="Flockie" width={48} height={43} className="h-10 w-auto" />
            <p className="mt-3 text-2xl font-extrabold">Find your flock.</p>
            <span className="mt-3 inline-block rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-white/70">
              Beta — not yet a registered company
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
          <p>© 2026 Flockie. Made for travelers and doers.</p>
          <div className="flex gap-4 font-bold">
            <Link href="/safety" className="hover:text-white">
              Safety
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
