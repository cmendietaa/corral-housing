-- RLS check for private boards. Runs inside one transaction and rolls back,
-- so it leaves nothing behind. Raises an exception on the first failed check.
--
--   supabase db query --remote -f supabase/tests/rls_check.sql
--
-- Three fake users: Alice creates a board, Bob joins with an invite, and
-- Olive (an outsider) tries to read and write it by id.

begin;

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-a000-00000000000a', 'alice@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-00000000000b', 'bob@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-00000000000c', 'olive@example.test', 'authenticated', 'authenticated');

create temporary table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

set local role authenticated;

-- Alice creates a board, adds a place, and makes an invite.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
insert into t values ('board', public.create_board('RLS test board', 'Alice', '2027–28', 140000));
insert into public.listings (board_id, title, url)
  select v, 'Test place', 'https://example.com/a' from t where k = 'board';
with i as (
  insert into public.invites (board_id) select v from t where k = 'board' returning token
)
insert into t select 'invite', token from i;
with i as (
  insert into public.invites (board_id) select v from t where k = 'board' returning token
)
insert into t select 'expired', token from i;

do $$
begin
  if (select count(*) from public.listings l join t on t.v = l.board_id and t.k = 'board') <> 1 then
    raise exception 'FAIL: the owner cannot see their own listing';
  end if;
  begin
    insert into public.listings (board_id, title, url)
      select v, 'Bad link', 'javascript:alert(1)' from t where k = 'board';
    raise exception 'FAIL: a javascript: URL was accepted';
  exception when check_violation then null;
  end;
  raise notice 'PASS: owner can read and write; javascript: URLs are rejected';
end $$;

-- Expire the second invite (as the table owner, outside RLS).
reset role;
update public.invites set expires_at = now() - interval '1 day' where token = (select v from t where k = 'expired');
set local role authenticated;

-- Olive, an outsider who knows the board id.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}';
do $$
declare
  v_board uuid := (select v from t where k = 'board');
  n int;
begin
  select count(*) into n from public.boards where id = v_board;
  if n <> 0 then raise exception 'FAIL: outsider can read the board'; end if;
  select count(*) into n from public.listings where board_id = v_board;
  if n <> 0 then raise exception 'FAIL: outsider can read listings'; end if;
  select count(*) into n from public.board_members where board_id = v_board;
  if n <> 0 then raise exception 'FAIL: outsider can read members'; end if;
  select count(*) into n from public.invites where board_id = v_board;
  if n <> 0 then raise exception 'FAIL: outsider can read invites'; end if;

  update public.listings set title = 'hacked' where board_id = v_board;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: outsider updated a listing'; end if;
  delete from public.listings where board_id = v_board;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: outsider deleted a listing'; end if;

  begin
    insert into public.listings (board_id, title, url) values (v_board, 'x', 'https://example.com');
    raise exception 'FAIL: outsider inserted a listing';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.board_members (board_id, user_id, display_name)
    values (v_board, '00000000-0000-4000-a000-00000000000c', 'Olive');
    raise exception 'FAIL: outsider added themselves as a member';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.redeem_invite((select v from t where k = 'expired'), 'Olive');
    raise exception 'FAIL: an expired invite worked';
  exception when raise_exception then
    if sqlerrm <> 'invite_expired' then raise; end if;
  end;
  begin
    perform public.redeem_invite(gen_random_uuid(), 'Olive');
    raise exception 'FAIL: a made-up invite worked';
  exception when no_data_found then null;
  end;
  raise notice 'PASS: outsider is refused reads, writes, self-join, expired and invalid invites';
end $$;

-- Bob joins with the valid invite, then collaborates.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
do $$
declare
  v_board uuid := (select v from t where k = 'board');
  n int;
begin
  if public.redeem_invite((select v from t where k = 'invite'), 'Bob') <> v_board then
    raise exception 'FAIL: redeem_invite returned the wrong board';
  end if;
  select count(*) into n from public.listings where board_id = v_board;
  if n <> 1 then raise exception 'FAIL: invited member cannot see listings'; end if;
  update public.listings set status = 'contacted', next_action = 'Ask about parking',
    next_action_assignee = '00000000-0000-4000-a000-00000000000a'
  where board_id = v_board;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: invited member cannot update a listing'; end if;
  begin
    update public.listings set next_action_assignee = '00000000-0000-4000-a000-00000000000c' where board_id = v_board;
    raise exception 'FAIL: a non-member was assigned a next step';
  exception when check_violation then null;
  end;
  begin
    update public.board_members set role = 'owner' where user_id = '00000000-0000-4000-a000-00000000000b';
    raise exception 'FAIL: a member promoted themselves to owner';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.listings set board_id = gen_random_uuid() where board_id = v_board;
    raise exception 'FAIL: a member moved a listing to another board';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: invited member can collaborate but not escalate';
end $$;

-- Signed-out (anon) visitors get nothing at all.
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  begin
    perform 1 from public.listings limit 1;
    raise exception 'FAIL: anon can query listings';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_board('x', 'x');
    raise exception 'FAIL: anon can call create_board';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: anon has no access';
end $$;

reset role;
select 'ALL RLS CHECKS PASSED' as result;
rollback;
