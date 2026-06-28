-- Vibe location privacy, phase 2 of 2.
-- Run only AFTER the matching app PR is deployed. This removes direct reads of
-- complete Vibe rows for non-hosts. Browsing continues through vibe_directory;
-- confirmed attendees receive exact logistics through vibe_private_logistics.

begin;

do $$
begin
  if to_regclass('public.vibe_directory') is null then
    raise exception 'Run vibe-location-privacy-prepare.sql before enforcement';
  end if;
end
$$;

drop policy if exists "vibes readable" on public.vibes;
drop policy if exists "vibes host read" on public.vibes;
create policy "vibes host read"
  on public.vibes
  for select
  to authenticated
  using (host_id = auth.uid());

commit;
