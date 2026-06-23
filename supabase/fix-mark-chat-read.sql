-- Fix: unread badges counted every message because mark_chat_read wasn't
-- updating chat_reads.last_read_at on open. Recreate it as a SECURITY DEFINER
-- upsert (chat_reads PK is (user_id, chat_id)). Run in the Supabase SQL editor.
-- Safe to re-run.
create or replace function public.mark_chat_read(p_chat uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.chat_reads (user_id, chat_id, last_read_at)
  values (auth.uid(), p_chat, now())
  on conflict (user_id, chat_id) do update set last_read_at = now();
$$;
grant execute on function public.mark_chat_read(uuid) to authenticated;
