-- Persisted per-user language. Drives localized transactional emails (rendered
-- in the RECIPIENT's locale) and can seed the UI locale. Idempotent — safe to
-- run more than once. Valid values: 'en', 'es', 'pt' (pt is pt-BR).
alter table public.profiles
  add column if not exists locale text not null default 'en';

-- Constrain to the supported locales. Dropped-and-recreated so re-runs stay clean.
alter table public.profiles
  drop constraint if exists profiles_locale_check;
alter table public.profiles
  add constraint profiles_locale_check check (locale in ('en', 'es', 'pt'));
