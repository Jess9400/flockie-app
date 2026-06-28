"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const supabase = createClient();
  const redirect = safeRedirectPath(searchParams.get("redirect"), "/home");
  const referral = searchParams.get("ref");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    // Terms consent is persisted server-side in the OAuth callback (accept_terms),
    // gated on the null terms_accepted_at column. The clickwrap text below is the
    // point of consent.
    setLoading(true);
    const callbackParams = new URLSearchParams({ next: redirect });
    if (referral) callbackParams.set("ref", referral);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${callbackParams.toString()}`,
      },
    });
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
          Find someone to go with. <span className="text-flockie-coral">Anywhere.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-center text-sm font-medium leading-relaxed text-white/70">
          Dinner tonight, a weekend trip, or just someone to hit the museum with. 5 quick
          questions and we&rsquo;ll find your people.
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-9 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-white py-3.5 font-bold disabled:opacity-50"
        >
          {loading ? "Connecting…" : "Continue with Google"}
        </button>

        <p className="mt-4 text-center text-xs font-medium leading-relaxed text-white/60">
          By continuing, you agree to Flockie&rsquo;s{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold text-flockie-coral underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-flockie-coral underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
