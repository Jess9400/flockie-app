import Link from "next/link";
import SocialIcons from "@/components/SocialIcons";

export default function Footer() {
  return (
    <footer className="mt-12 border-t-2 border-ink bg-white px-5 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
          <Link href="/privacy" className="hover:text-flockie-orange">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-flockie-orange">
            Terms &amp; Conditions
          </Link>
          <a href="mailto:hello@findflockie.com" className="hover:text-flockie-orange">
            hello@findflockie.com
          </a>
        </div>
        <SocialIcons />
      </div>
      <p className="mt-4 text-xs font-medium text-muted">
        © 2026 Flockie. Made for travelers and doers.
      </p>
    </footer>
  );
}
