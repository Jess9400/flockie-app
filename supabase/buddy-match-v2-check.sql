-- Read-only regression checks for the canonical matching helpers.
-- Run after supabase/vibe-traits.sql. Raises an exception on a regression.

do $$
declare
  value numeric;
begin
  value := public._buddy_interest_pair_fit('outdoors', 'adventure');
  if value <> 0.90 then
    raise exception 'related interest fit changed: %', value;
  end if;

  value := public._buddy_interest_pair_fit('good_food', 'good_food');
  if value <> 1.00 then
    raise exception 'exact interest fit changed: %', value;
  end if;

  value := public._buddy_interest_pair_fit('good_food', 'getting_active');
  if value <> 0 then
    raise exception 'unrelated interest fit changed: %', value;
  end if;

  value := public._buddy_style_pair_fit('social', 'energetic');
  if value <> 0.80 then
    raise exception 'related style fit changed: %', value;
  end if;

  value := public._buddy_goal_fit('crew', 'friends');
  if value <> 0.85 then
    raise exception 'related goal fit changed: %', value;
  end if;

  value := public._buddy_array_fit(
    array['outdoors', 'good_food'],
    array['adventure', 'good_food'],
    'interest'
  );
  if value < 0.94 or value > 0.96 then
    raise exception 'symmetric array fit changed: %', value;
  end if;
end;
$$;
