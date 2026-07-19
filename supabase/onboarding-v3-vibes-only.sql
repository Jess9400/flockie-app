alter table public.profiles
  add column if not exists vibe_interests text[] not null default '{}',
  add column if not exists vibe_goal text check (vibe_goal is null or vibe_goal in ('crew', 'friends', 'doers', 'out')),
  add column if not exists vibe_traits jsonb not null default '{}'::jsonb,
  add column if not exists vibe_persona text check (vibe_persona is null or vibe_persona in ('connector', 'easygoer', 'live_wire', 'deep_diver'));
