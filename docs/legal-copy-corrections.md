# Legal copy corrections (2026-06-28)

Corrections to apply to the **full beta Privacy Policy / Terms drafts** before
publishing them at `/privacy` and `/terms`. These reconcile the legal text with
what the app actually does (verified against the codebase during the 2026-06-28
audit). The **live short pages** already carry the equivalent wording (PR #109);
these notes are for the comprehensive drafts that aren't published yet.

Contact for all legal/privacy matters: **hello@findflockie.com**

---

## Fix #2 — Location is precise, not "city-level approximate"

The app stores a precise `location geography(point)` per profile (via
`set_my_location(lng, lat)`) and uses it for distance matching. The draft
understated this.

**In Privacy Policy → "What we collect" → "Information collected automatically", replace:**

> - City-level approximate location, to surface nearby Vibes

**with:**

> - Your location — including precise coordinates from your device when you grant
>   permission — used to surface nearby people and Vibes and to measure distance.
>   Other members never see your exact location, only your city.

---

## Fixes #1 + #3 — Retention matches immediate deletion; drop the 3-year claim

`delete_my_account()` performs an immediate hard cascade delete of the user's
`auth.users` row, wiping all related data at once. There is **no** mechanism that
retains suspended-account records, so the "3 years to prevent re-registration"
claim was untrue and has been removed.

**In Privacy Policy → "How long we keep it", replace:**

> - Active account data: while your account is active
> - Deleted account data: removed within 30 days, backups purged within 90 days
> - Safety incident records (suspended accounts): up to 3 years to prevent re-registration

**with:**

> - **Active account data:** kept while your account is active.
> - **Deleted account data:** when you delete your account, your profile and
>   personal data are removed immediately and permanently. Any copies in routine
>   system backups are rotated out shortly afterward and cannot be restored to
>   your account.

**In Terms → "Suspension and termination", replace:**

> After deletion, your profile is removed from public view immediately and your
> personal data is deleted within 30 days, subject to the retention rules in our
> Privacy Policy.

**with:**

> After deletion, your profile is removed immediately and your personal data is
> permanently deleted right away, subject to the retention details in our Privacy
> Policy.

---

## Decision log

- **3-year suspended-account retention / re-registration prevention: NOT claimed.**
  We don't have the mechanism yet, so the claim stays out of the documents. If we
  later want to advertise re-registration prevention, build a suppression list
  first (store a *hashed* identifier on suspension/deletion, checked at signup),
  then re-add accurate copy.

## Still open for go-live (not done)
- Publish the full beta Privacy Policy / Terms drafts (replacing the live short
  pages), with the corrections above applied.
- Create the **Safety Guide** page the Terms link to (or remove the link).
- Footer "Beta — not yet a registered company" tag + `/about` founder/roadmap page.
- Signup beta acknowledgment + required checkbox — **DONE** (PR #109).
- Consent timestamp persistence (`accept_terms` / `terms_accepted_at`) — **DONE** (PR #108).
