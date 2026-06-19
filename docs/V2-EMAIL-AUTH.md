# V2 — Bring back email auth

Deferred at launch (see `docs/AUTH.md`). This is the plan to re-introduce email-based
sign-in when we have the bandwidth to support it.

## Recommendation: magic links, not passwords
When we add a non-Google option, prefer **magic links / OTP** over passwords:
- No passwords to forget → no reset flow → far less support load (the exact reason we cut email).
- Supabase has it built in: `supabase.auth.signInWithOtp({ email })` → user clicks the email link → `/auth/callback`.
- Same verified-email guarantee as confirmation, but one step instead of "set a password, confirm, then sign in."

Only add classic email+password if a real user need shows up (e.g. users without email-app access, or enterprise).

## Scope when we do it
1. **Login UI** (`src/app/login/page.tsx`)
   - Add below the Google button: an email field + "Email me a link" button + an "or" divider (the old divider styling is in git history).
   - Magic-link path: `await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: \`${origin}/auth/callback?next=<redirect>\` } })` then show "Check your email."
   - Keep the passive Terms text; for brand-new accounts still set `localStorage["flockie-pending-terms"]` before sending the link.
   - Re-wrap in `<Suspense>` already done; keep the `redirect` param handling.
2. **Callback** (`src/app/auth/callback/route.ts`) — already handles `?next=`; no change needed for magic links (same code exchange).
3. **Supabase dashboard**
   - Email provider enabled; customize the **magic-link email template** (branding).
   - Confirm SMTP / rate limits are set (default Supabase email is rate-limited; consider a custom SMTP like Resend for volume).
   - Redirect URLs already include `app.findflockie.com/**`.
4. **(If passwords instead of magic links)** also build:
   - `signUp` + `signInWithPassword` handlers (in git history pre-2026-06-19).
   - A **password reset** flow: `resetPasswordForEmail` + a `/auth/reset` page that calls `updateUser({ password })`. This is the piece that creates support load — don't ship without it.

## Reference: the removed code
The full email/password login UI lived in `src/app/login/page.tsx` before commit on 2026-06-19
("Google-only login"). `git log --oneline -- src/app/login/page.tsx` →  `git show <commit>^:src/app/login/page.tsx` to recover the exact JSX/handlers.

## Acceptance for v2
- New + returning users can authenticate without Google.
- No dead-end: forgotten access is self-serve (magic link re-send, or password reset page).
- Deep-link redirect (invite flow) still works through the email path.
- Terms acceptance recorded for new accounts.
