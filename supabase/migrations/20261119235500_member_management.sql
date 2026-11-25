-- Board settings: member management that can't strand a board.
--
-- 1. The owner can't leave or be removed. They hand the board to someone else
--    first (transfer_board_ownership) or delete the board. Before this, the
--    owner could delete their own membership and leave a board nobody could
--    manage.
-- 2. When someone leaves or is removed, the next steps assigned to them go
--    back to unassigned, and invite links they made stop working.
-- 3. Board renames and budget changes reach the other members live.

-- ---------------------------------------------------------------------------
-- 1. Leaving and removing
-- ---------------------------------------------------------------------------
drop policy "Members can leave, owners can remove" on public.board_members;

create policy "Members can leave, owners can remove others" on public.board_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = (select auth.uid()) or (select private.is_board_owner(board_id)))
  );

-- Hand the board to another member. Only the owner can, and there is always
-- exactly one owner. Deleting the board (which cascades) is unaffected.
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

  update public.board_members set role = 'member' where board_id = p_board_id and user_id = v_uid;
  update public.board_members set role = 'owner' where board_id = p_board_id and user_id = p_user_id;
end;
$$;

revoke all on function public.transfer_board_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_board_ownership(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tidy up after someone leaves or is removed
-- ---------------------------------------------------------------------------
create or replace function private.after_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Deleting the whole board removes its members too; there's nothing to tidy.
  if not exists (select 1 from public.boards b where b.id = old.board_id) then
    return null;
  end if;

  update public.listings
  set next_action_assignee = null
  where board_id = old.board_id and next_action_assignee = old.user_id;

  update public.invites
  set revoked = true
  where board_id = old.board_id and created_by = old.user_id and not revoked;

  return null;
end;
$$;

revoke all on function private.after_member_removed() from public, anon, authenticated;

create trigger board_members_after_delete
after delete on public.board_members
for each row execute function private.after_member_removed();

-- ---------------------------------------------------------------------------
-- 3. Live board details
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.boards;
