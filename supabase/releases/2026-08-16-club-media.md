# 2026-08-16 Club media library

## Canonical source

- `supabase/club-media.sql`

## Scope

- New PRIVATE storage bucket `club-media` (50 MB per-file limit). No existing data changes.
- New table `public.club_media` (metadata: path, kind photo/video/file, title, uploader) with RLS: member read, manager (host or moderator) insert, uploader-or-host delete.
- New helper `_club_media_club(text)` (path → club uuid, fails closed to null on garbage paths; SECURITY DEFINER, explicit search_path, authenticated-only execute).
- Three `storage.objects` policies scoped to `bucket_id = 'club-media'`: manager upload, member read, uploader-or-host delete. Existing avatars/videos bucket policies untouched.
- No anonymous surface; `public-rpc-allowlist.json` unchanged. Members access files via short-lived signed URLs (1 h), so leaving the club ends access.

## Preconditions

- `club-moderators.sql` live (`is_club_member`, `is_club_manager`, `is_club_host` helpers) - verified on prod 2026-08-14.

## Deploy

- Run `supabase/club-media.sql` in the Supabase SQL editor (production). Idempotent, safe to re-run.
- Runner: founder, after the app deploy. Before the SQL runs, the media page shows an empty gallery and uploads fail with a storage error; nothing else is affected.

## Verify

- Preflight (read-only): `select id, public, file_size_limit from storage.buckets where id = 'club-media';` → one row, `public = false`, limit 52428800.
- Anon probe: `GET /storage/v1/object/club-media/<anything>` with the anon key must be denied.
- User path: as club host, club page → "Club media" card → upload a photo; as a regular member, open the same page and confirm the photo renders but no Upload button shows; as a non-member, confirm /clubs/<id>/media redirects to the club page.

## Rollback

- `drop policy` the three storage policies, `drop table public.club_media;`, and empty + delete the `club-media` bucket in the dashboard. Uploaded objects must be deleted before the bucket can be removed.
