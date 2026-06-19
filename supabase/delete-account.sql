-- delete_my_account(): lets a signed-in user delete their own account.
-- Deleting the auth.users row cascades to public.profiles (FK on delete cascade)
-- and any other tables that reference the user with on-delete-cascade.
-- Run this whole block in the Supabase SQL editor.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
