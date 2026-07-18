"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/redirects";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations("components");
  const searchParams = useSearchParams();
  const supabase = createClient();
  const redirect = safeRedirectPath(searchParams.get("redirect"), "/home");
  const referral = searchParams.get("ref");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleGoogle() {
    // Consent is the required checkbox below; the acceptance timestamp is then
    // persisted server-side in the OAuth callback (accept_terms), gated on the
    // null terms_accepted_at column.
    if (!agreed) return;
    setLoading(true);
    const callbackParams = new URLSearchParams({ next: redirect });
    if (referral) callbackParams.set("ref", referral);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${callbackParams.toString()}`,
      },
    });
    // On success the browser redirects away; if it errors, re-enable the button.
    if (error) setLoading(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F2A4C] px-6 py-10">
      <div className="w-full max-w-sm">
        <Image
          src="/logo-mark-white.svg"
          alt="Flockie"
          width={64}
          height={56}
          priority
          className="mx-auto h-14 w-auto"
        />
        <h1 className="mt-5 text-center text-4xl font-black leading-tight tracking-tight text-white">
          {t("login.headline")} <span className="text-flockie-coral">{t("login.headlineAccent")}</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-center text-sm font-medium leading-relaxed text-white/70">
          {t("login.subheading")}
        </p>

        <label className="mt-8 flex cursor-pointer items-start gap-3 text-left text-xs font-medium leading-relaxed text-white/70">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-flockie-coral"
          />
          <span>
            {t("login.consentPrefix")}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold text-flockie-coral underline">
              {t("login.terms")}
            </a>
            {t("login.consentAnd")}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-flockie-coral underline">
              {t("login.privacy")}
            </a>
            .
          </span>
        </label>

        <button
          onClick={handleGoogle}
          disabled={loading || !agreed}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white py-3.5 font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t("login.connecting") : t("login.continueGoogle")}
        </button>
      </div>
    </main>
  );
}
