import Link from "next/link";
import Image from "next/image";

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-cream font-dm">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/" className="inline-block">
          <Image src="/logo.svg" alt="Flockie" width={120} height={40} className="h-8 w-auto" />
        </Link>
        <h1 className="mt-8 text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-muted">Last updated: {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] font-medium text-ink/80">{children}</div>
      </div>
    </main>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-extrabold text-ink">{heading}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
