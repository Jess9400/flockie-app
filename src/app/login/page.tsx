"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const redirect = searchParams.get("redirect") || "/match";
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !agreed) {
      return setMsg("Please agree to the Terms and Privacy Policy to continue.");
    }
    setLoading(true);
    setMsg(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { terms_accepted_at: new Date().toISOString() },
        },
      });
      setLoading(false);
      if (error) return setMsg(error.message);
      setMsg("Check your email to confirm your account, then sign in.");
      setMode("signin");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMsg(error.message);
    router.push(redirect);
    router.refresh();
  }

  async function handleGoogle() {
    if (mode === "signup" && !agreed) {
      return setMsg("Please agree to the Terms and Privacy Policy to continue.");
    }
    if (mode === "signup") {
      try {
        localStorage.setItem("flockie-pending-terms", "1");
      } catch {}
    }
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
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
        <h1 className="mt-5 text-center text-4xl font-black tracking-tight text-white">
          Find your <span className="text-flockie-coral">flock.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-center text-sm font-medium leading-relaxed text-white/70">
          Dinner tonight, a weekend trip, or just someone to hit the museum with.
          5 quick questions and we&rsquo;ll find your people.
        </p>
        <p className="mt-5 text-center font-bold text-white/90">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </p>

        {mode === "signup" && (
          <label className="mt-8 flex items-start gap-2.5 text-sm font-medium text-white/80">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-flockie-orange"
            />
            <span>
              I agree to Flockie&rsquo;s{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold text-flockie-orange underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-flockie-orange underline">
                Privacy Policy
              </a>
              , including how my data is stored.
            </span>
          </label>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          className={`flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-white py-3 font-bold disabled:opacity-50 ${
            mode === "signup" ? "mt-4" : "mt-8"
          }`}
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold text-white/50">
          <span className="h-px flex-1 bg-white/20" /> or{" "}
          <span className="h-px flex-1 bg-white/20" />
        </div>

        <form onSubmit={handleEmail} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl border-2 border-ink bg-white px-4 py-3 font-medium outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl border-2 border-ink bg-white px-4 py-3 font-medium outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full border-2 border-ink bg-flockie-orange py-3 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
          >
            {mode === "signup" ? "Sign up" : "Sign in"}
          </button>
        </form>

        {msg && (
          <p className="mt-4 text-center text-sm font-medium text-flockie-orange">
            {msg}
          </p>
        )}

        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setMsg(null);
          }}
          className="mt-6 w-full text-center text-sm font-semibold text-white/70 underline"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
    </main>
  );
}
