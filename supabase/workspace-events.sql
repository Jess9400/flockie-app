-- ============================================================================
-- Flockie - Post a system line into a chat when something happens in the shared
-- workspace (a to-do checked/added, a cost added, a meeting scheduled, an RSVP).
-- Null sender = renders as a centered system message. Membership-gated.
-- Run in the SQL editor. Idempotent.
-- ============================================================================

create or replace function public.post_workspace_event(p_kind text, p_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_text is null or char_length(btrim(p_text)) = 0 or char_length(p_text) > 500 then
    return;
  end if;

  if p_kind = 'club' then
    if not (public.is_club_member(p_id) or public.is_club_host(p_id)) then
      raise exception 'not_allowed';
    end if;
    insert into public.club_messages (club_id, sender_id, content) values (p_id, null, p_text);
  elsif p_kind = 'buddy' then
    if not public.is_buddy_chat_member(p_id) then
      raise exception 'not_allowed';
    end if;
    insert into public.buddy_messages (chat_id, sender_id, content) values (p_id, null, p_text);
  end if;
end;
$$;
grant execute on function public.post_workspace_event(text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
