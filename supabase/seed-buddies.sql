-- Seed 24 travelers with a Lisbon trip so buddy matching (min 20) is testable.
-- Run AFTER trips-and-buddy.sql. Re-running is safe.
create extension if not exists pgcrypto;

do $$
declare
  i int; uid uuid;
  pics text[] := array[
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=400&q=80'
  ];
  genders text[] := array['Woman','Man','Non-binary'];
begin
  for i in 1..24 loop
    if exists (select 1 from auth.users where email = 'btest' || i || '@flockie.test') then
      continue;
    end if;
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'btest' || i || '@flockie.test', crypt('Password123!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    update public.profiles set
      display_name = 'Traveler ' || i,
      age = 23 + (i % 14),
      gender = genders[1 + (i % 3)],
      home_city = 'Lisbon',
      photos = array[pics[1 + (i % 5)]],
      one_liner = 'Down for a Lisbon adventure ' || i,
      planning = 1 + (i % 5), pace = 1 + ((i+1) % 5),
      social_energy = 1 + ((i+2) % 5), budget = 1 + ((i+3) % 5),
      nightlife = 1 + ((i+4) % 5), adventurousness = 1 + (i % 5),
      trip_vibe = array['Beach / coast','City exploration','Foodie / culinary'],
      travel_style = array['I want to make new friends along the way'],
      activities = array['Surf','Coffee culture / café-hopping'],
      activity_skills = jsonb_build_object('Surf', 1 + (i % 5)),
      activity_social = 1 + ((i+1) % 5), activity_intensity = 1 + ((i+2) % 5),
      activity_vibe = array['Social, lots of conversation'],
      onboarding_complete = true
    where id = uid;

    insert into public.trips (user_id, destination, start_date, end_date, group_size, trip_type, budget, pace, status)
    values (uid, 'Lisbon', current_date + 10, current_date + 18, 2 + (i % 4),
            array['Beach / coast','City exploration'], 1 + ((i+3) % 5), 1 + ((i+1) % 5), 'active');
  end loop;
end $$;
