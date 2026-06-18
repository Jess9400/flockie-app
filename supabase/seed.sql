-- Seed ~12 fake users with varied vibe/activity profiles. Run in SQL Editor.
-- Re-running is safe (skips emails that already exist).

create extension if not exists pgcrypto;

do $$
declare
  i int;
  uid uuid;
  cities text[] := array['Lisbon','Bali','Mexico City','Tokyo'];
  acts text[] := array['Surf','Yoga','Hiking / trekking','Photography',
                       'Cooking / food experiences','Coffee culture / café-hopping',
                       'Running','Dancing'];
  genders text[] := array['Woman','Man','Non-binary'];
begin
  for i in 1..12 loop
    if exists (select 1 from auth.users where email = 'seed' || i || '@flockie.test') then
      continue;
    end if;
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'seed' || i || '@flockie.test', crypt('Password123!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    -- profile auto-created by trigger; fill it with varied data
    update public.profiles set
      display_name = 'Seed ' || i,
      age = 22 + (i % 15),
      gender = genders[1 + (i % 3)],
      home_city = cities[1 + (i % 4)],
      planning = 1 + (i % 5),
      pace = 1 + ((i + 1) % 5),
      social_energy = 1 + ((i + 2) % 5),
      budget = 1 + ((i + 3) % 5),
      nightlife = 1 + ((i + 4) % 5),
      adventurousness = 1 + (i % 5),
      trip_vibe = array['Beach / coast','City exploration'],
      activities = array[acts[1 + (i % 8)], acts[1 + ((i + 3) % 8)]],
      activity_skills = jsonb_build_object(
        acts[1 + (i % 8)], 1 + (i % 5),
        acts[1 + ((i + 3) % 8)], 1 + ((i + 2) % 5)
      ),
      activity_social = 1 + ((i + 1) % 5),
      activity_intensity = 1 + ((i + 2) % 5),
      activity_vibe = array['Social, lots of conversation'],
      one_liner = 'Seed traveler ' || i,
      onboarding_complete = true
    where id = uid;
  end loop;
end $$;

-- Add all seed users as "interested" in a given vibe (call after creating one).
-- Usage:  select public.seed_interest('<vibe-uuid>');
create or replace function public.seed_interest(p_vibe uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.vibe_interests (vibe_id, user_id, status)
  select p_vibe, p.id, 'interested'
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like '%@flockie.test'
  on conflict (vibe_id, user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.seed_interest(uuid) to authenticated;
