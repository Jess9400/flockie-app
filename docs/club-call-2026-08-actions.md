# Club monetization call (Jessica x Taya, Aug 2026) - organized into actions

Raw call notes sorted into themes. Each item is tagged:

- **BUILD** - clear enough to build now, no external dependency
- **DECIDE** - needs a product/pricing decision from the founders first
- **RESEARCH** - needs a third party, legal, or technical investigation
- **LATER** - real idea, wrong moment (pre-revenue, pre-incorporation, or heavy)

North-star for sequencing: **2 running clubs and 100 users by end of month.**
Anything that does not serve that goal directly goes after it.

---

## 1. Club membership tiers (the core of the call)

The model: every club has FREE members and PAID members. Free keeps the funnel
open; paid funds the club and makes belonging visible.

| Idea from the call | Action | Tag |
|---|---|---|
| Free member: chat access, can attend paying the event fee | Baseline behavior, mostly exists today | BUILD |
| Paid member: exclusive events, content, "friends" | Add a `paid` membership flag + perks model per club | DECIDE (perk list per club) |
| Visible "paid member" tag | Badge in roster/chat once the flag exists | BUILD (after flag) |
| Event pricing split (example: free beer included for paid members, free members pay the event fee) | Per-gathering price for non-paid members | DECIDE pricing UX |
| Physical kits (book of the month + courtesy item, book-club style) | Ops, not code: host promises, Flockie tracks entitlement | LATER (manual first) |
| Paid chat perks: GIFs, "call attention" (vibration), filtered chats | Chat perk pack for paid members | LATER (nice-to-have, after flag) |
| Free vs paid content areas; paid content access for creators | Extend the new club media library with a "paid members only" flag per item | BUILD (small, once membership flag exists) |
| "Pay to keep your community alive" (club subscription to Flockie) | This is Flockie-side revenue, different from member-pays-club | DECIDE which one comes first |

**Suggested order:** membership flag + badge + paid-only media flag first (all
buildable), perks and event-price splits after payments exist.

## 2. Payments and money movement

| Idea | Action | Tag |
|---|---|---|
| NowPayments integration (crypto payments) | Evaluate: fees, KYC, BRL support, payout to hosts | RESEARCH |
| Every host has a wallet? | Depends on payment rail chosen; do not decide before rail | DECIDE after research |
| Escrow: pay in advance to secure a spot, release to host at the event | Real feature, heavy: hold funds, refunds, disputes | LATER |
| Pay host on the spot (Pix/cash) with Flockie only tracking it | Cheapest v1: mark-as-paid tracking, no money touches Flockie | BUILD (candidate v1) |
| Host chooses currency | Field on club/gathering; display only until real payments | BUILD (display level) |
| NFT per paid member (access pass to content/events) | Advise strongly to defer: adds wallets, gas, support burden, and legal surface for zero user benefit over a database membership flag. The membership flag gives identical access control. Revisit only if a partner demands it | LATER |
| Cashback on platform purchases | Needs real payment volume first | LATER |
| Existing plan check: memory/notes say Stripe after incorporation, Plus at $9.99 | The "$10 Flockie draft" from the call conflicts slightly with the $9.99 plan; align on one number | DECIDE |

**Recommended v1 money path:** no funds through Flockie yet. Paid membership
is recorded by the host (mark-as-paid), collected via Pix/cash/NowPayments
link outside the app. Build the entitlement layer now, the rail later.

## 3. Flockie membership cross-benefits (platform tier)

| Idea | Action | Tag |
|---|---|---|
| Flockie members: 2 clubs free, or 2 months free, or 50% off entrance | Pick ONE offer, they overlap | DECIDE |
| 5 free spots per club for Flockie members; if sold out, recommend other clubs | Inventory concept per club + recommendation fallback | LATER (needs paid clubs live) |
| Monthly coupons (5 discounts) for members | Partner/ops driven | LATER |
| Sell your invitation right (+1 / +3) | Invite-transfer feature; fun but niche | LATER |
| Hosts are Flockie members, revenue share | Part of the pricing model conversation | DECIDE |

## 4. Joining rituals and exclusivity (serves the month goal directly)

These make clubs feel earned and are mostly buildable without payments:

| Idea | Action | Tag |
|---|---|---|
| Attendance-earned membership (meet the club physically first) | Already live (attendance -> join prompt -> approval) | DONE |
| Taster: non-members can attend 1 meetup to get a hint | Already the natural flow (gatherings are open vibes) - make it explicit in copy | BUILD (copy) |
| Request to join with a "why I deserve it" message (LinkedIn style) | Add a note field to the membership request + show it to approvers | BUILD |
| 3 questions to see if you match the club | Per-club application questions defined by host | BUILD |
| Members vote yes/no on applicants (democratic entry) | Member voting on requests; moderators/host still confirm | BUILD (v2 of requests) |
| Join by paying OR by being voted in | Combine with membership tiers later | DECIDE |
| Club values, rules, objectives on the club page | New club profile fields | BUILD |
| Moderation: topics forbidden in the club | Club rules field + moderator delete powers in chat | BUILD |
| Match the club vibe (matching score vs club) | Extend vibe matching to clubs | LATER (algorithm work) |

## 5. Chat and language

| Idea | Action | Tag |
|---|---|---|
| Automatic translation in the chat | Needs a decision: per-message machine translation costs money per message. Options: translate-on-tap (cheap, only when asked) vs auto-translate-all (expensive). Recommend translate-on-tap v1 | DECIDE then BUILD |
| Add Russian language | Mechanical: 4th locale in the existing i18n system (en/es/pt + ru), plus geo-IP mapping for RU/KZ/BY | BUILD |
| Polls in chat ("what are we doing today?") -> host creates the event from the winning option | Poll message type + create-gathering-from-poll shortcut | BUILD |
| Games in the chat | Undefined; park until one concrete game is named | LATER |
| GIFs / attention perks | See paid perks above | LATER |

## 6. Club tooling and verticals

| Idea | Action | Tag |
|---|---|---|
| Customizable tools per club (check with Taya's friend) | Talk to the friend first; capture requirements before building plugin-anything | RESEARCH |
| Photography club (tips), Vibe coders club | These are flagship club candidates for the 2-clubs goal, not features. Recruit hosts | OPS |
| Telegram bots / Twitter-YouTube paid membership | Competitive references for the perks list, not features | REFERENCE |
| Partner venues (restaurants, coffee shops) hosting vibes/clubs with discounts/commissions | Ops list + later a "partner venue" field on gatherings | OPS then BUILD |
| Ads on the platform, localized ads | Revenue line three; needs traffic first | LATER |
| Set KPIs | See goals below | DECIDE |

## 7. Small product items caught in the notes

- "Soon" tag on trips and flocks - BUILD, small.
- Use the app to filter people, create an activity, invite people in your city - mostly exists (activity board + invites); audit the flow for gaps.

## 8. Goals from the call

- 2 running clubs by end of month, 100 users.
- KPIs to define: active clubs, weekly gathering attendance, member->paid conversion (once payments exist), retention per club.

---

## Suggested build sequence (serves the month goal, no payment rail needed)

1. Club values / rules / objectives fields + forbidden-topics rules (identity).
2. Request-to-join with a reason note + per-club application questions.
3. Member voting on applicants (host/moderator confirms).
4. Membership flag `paid` + roster/chat badge + paid-only media items (entitlement layer, host marks paid manually).
5. Chat polls with create-gathering-from-poll.
6. Russian locale + geo mapping.
7. Translate-on-tap in chat (after cost decision).

## Open questions for the next founders' call

1. One number for Flockie Plus: $9.99 or $10?
2. Which Flockie-member club benefit: 2 free clubs, 2 free months, or 50% off? Pick one.
3. Member-pays-club vs club-pays-Flockie: which revenue line ships first?
4. NowPayments: who owns the research? (Needs BRL/Pix reality check.)
5. NFT pass: agree to park it? (Recommendation: yes - the membership flag does the same job without wallets.)
6. Taya's friend on club tools: set the call, capture requirements.
7. Translation: on-tap (cheap) or always-on (costly)?
8. KPI targets beyond "2 clubs / 100 users".

---

## Decisions drafted 2026-08-16 (brainstorm follow-up, pending Taya sign-off)

1. Paid tier is named **Socio** (socio-torcedor framing), monthly, host-priced, BRL default.
2. **V1 money path: none through Flockie.** Members pay the host directly; the host
   marks payments in the app; the app enforces perks (badge, socio-only media,
   lapsed -> free). BUILT: `supabase/club-socio-tier.sql` + Socio panel + member card.
3. **The 5% without custody:** v1 = recorded volume + monthly invoice to the host
   (enforced by feature access, not collections). Endgame after the CNPJ = Brazilian
   PSP split payments over Pix (Mercado Pago / Asaas / Pagar.me marketplace
   sub-accounts: member pays, processor auto-splits 95/5, Flockie never holds funds).
   Host "wallets" = PSP sub-accounts, not crypto wallets.
4. **Smart contracts: no** (forces crypto UX on beer-money payments, removes no legal
   obligations). **NFT passes: parked** - digital socio card (QR in app) covers the
   experience; a crypto-native club can mint an on-chain skin later without changing
   the source of truth.
5. NowPayments demoted to an optional extra rail for crypto-native clubs, not the backbone.

---

## Multi-provider payment architecture (added 2026-08-16, founder approved)

One internal system (club_payments + the socio/order records), three provider
adapters routed by currency. The platform fee is ALWAYS deducted at the
provider layer - the host's balance is born at 95%, Flockie never holds funds:

| Currency | Provider | Fee mechanism | Recurring | Status |
|---|---|---|---|---|
| Crypto | NowPayments | account-level / payout-minus-fee (confirm split with support) | manual renewals v1 | **INTEGRATED** - checkout + signed IPN webhook live behind env vars |
| BRL cards | Asaas | split at origin on every charge, incl. assinaturas | native auto-charge | adapter slot ready; blocked on Asaas platform-account answers |
| USD/intl cards | Stripe Connect | application_fee_amount per charge | Stripe Billing | **WAITS for the legal entity** (CNPJ or Atlas) - founder confirmed |

Flow: member taps pay -> /api/pay/checkout validates + snapshots via
create_club_payment -> provider hosted page -> provider webhook (HMAC-verified)
-> settle_club_payment (service-role only, idempotent) -> socio activated /
order marked paid + notifications. The host's manual "mark paid" remains as the
offline fallback forever.

To activate NowPayments: create the account, set payout wallet, add
NOWPAYMENTS_API_KEY + NOWPAYMENTS_IPN_SECRET in Vercel env, redeploy. Crypto
proceeds accrue in the platform NowPayments account; host payouts minus 5% are
manual (mass-payout API later).

### Draft message to Asaas sales (send via asaas.com chat/comercial)

> Ola! Estamos construindo a Flockie (findflockie.com), uma plataforma de
> comunidades locais onde organizadores de clubes cobram mensalidades e vendem
> produtos aos membros. Queremos usar o Asaas como meio de pagamento com split:
> o organizador recebe 95% e a plataforma 5% de cada cobranca, incluindo
> assinaturas recorrentes no cartao. Tres perguntas:
> 1. A conta-plataforma (que recebe os 5%) pode ser aberta como pessoa fisica
>    (CPF) nesta fase pre-CNPJ, ou o split/subcontas exige CNPJ?
> 2. O split funciona em assinaturas recorrentes criadas via API com cartao de
>    credito, cobrando automaticamente todo mes?
> 3. Os organizadores (recebedores dos 95%) podem ser pessoas fisicas com CPF,
>    criando as subcontas via API white-label?
> Obrigada!
