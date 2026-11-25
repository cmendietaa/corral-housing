-- Two hand-overs started at the same moment (say, a double tap that picks two
-- people) could each pass the owner check and leave the board with two
-- owners. Now the owner's own row is demoted first, only while it still says
-- 'owner'. The second hand-over waits on that row's lock, finds it no longer
-- an owner, and stops before promoting anyone.
create or replace function public.transfer_board_ownership(p_board_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.is_board_owner(p_board_id) then
    raise exception 'Only the board''s owner can hand it over.' using errcode = '42501';
  end if;
  if p_user_id = v_uid then
    return;
  end if;
  if not exists (
    select 1 from public.board_members m where m.board_id = p_board_id and m.user_id = p_user_id
  ) then
    raise exception 'That person isn''t on this board.' using errcode = 'P0002';
  end if;

  update public.board_members set role = 'member'
  where board_id = p_board_id and user_id = v_uid and role = 'owner';
  if not found then
    raise exception 'The board was just handed over. Refresh and try again.' using errcode = '40001';
  end if;

  update public.board_members set role = 'owner'
  where board_id = p_board_id and user_id = p_user_id;
  if not found then
    raise exception 'That person isn''t on this board.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.transfer_board_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_board_ownership(uuid, uuid) to authenticated;
