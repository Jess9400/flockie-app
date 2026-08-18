# 2026-08-18 Edit gathering photos

## Canonical source

- `supabase/vibe-edit-photos.sql`

## Scope

- `update_vibe_photos(p_vibe, p_photos text[])`: the host replaces a Vibe's
  photo array from the settings sheet (founder request: change a club
  gathering's cover). 1 to 5 photos; the first is the cover everywhere.
- Silent edit like `update_vibe_description` - no notification fan-out.
- Host-only (`is distinct from` guard), cancelled vibes rejected,
  authenticated-only with anon/public revoked per lockdown convention.
- App: Photos section in the gathering settings sheet (thumbnails, cover
  badge, remove, add up to 5, save). Uploads reuse the avatars bucket path
  convention from vibe creation.

## Preconditions

- None beyond base vibes schema.

## Deploy

- Run `supabase/vibe-edit-photos.sql` in the Supabase SQL editor. Safe to
  re-run.

## Verify

- Anon probe returns 42501:
  `POST /rest/v1/rpc/update_vibe_photos` with `{"p_vibe":"000...","p_photos":[]}`.
- User path: host opens gathering settings, adds a photo, saves; the card
  cover and chat header update.

## Rollback

- `drop function public.update_vibe_photos(uuid, text[]);` (feature is
  additive; the UI shows the RPC error if dropped).
