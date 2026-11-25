-- RLS check for private boards. Runs inside one transaction and rolls back,
-- so it leaves nothing behind. Raises an exception on the first failed check.
--
--   supabase db query --remote -f supabase/tests/rls_check.sql
--
-- Three fake users: Alice creates a board, Bob joins with an invite, and
-- Olive (an outsider) tries to read and write it by id. Then Alice removes
-- Bob, hands the board to him when he rejoins, and Bob deletes it.

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
  -- A place without a link (from a screenshot or word of mouth) is allowed.
  insert into public.listings (board_id, title, url)
    select v, 'No link yet', null from t where k = 'board';
  delete from public.listings where title = 'No link yet';
  raise notice 'PASS: owner can read and write; links are optional but javascript: URLs are rejected';
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

-- Tour photos: Bob (member) adds photos; the table and bucket stay in step.
do $$
declare
  v_board uuid := (select v from t where k = 'board');
  v_listing uuid := (select id from public.listings where board_id = v_board limit 1);
  v_path text;
  n int;
begin
  insert into public.listing_photos (board_id, listing_id) values (v_board, v_listing) returning path into v_path;
  insert into t values ('photo_listing', v_listing);
  if (select uploaded_by from public.listing_photos where path = v_path) <> '00000000-0000-4000-a000-00000000000b' then
    raise exception 'FAIL: photo uploader not recorded';
  end if;
  insert into storage.objects (bucket_id, name) values ('tour-photos', v_path);
  begin
    insert into storage.objects (bucket_id, name) values ('tour-photos', v_board || '/' || v_listing || '/' || gen_random_uuid() || '.jpg');
    raise exception 'FAIL: a member uploaded a file with no photo row';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.listing_photos (board_id, listing_id, uploaded_by)
      values (v_board, v_listing, '00000000-0000-4000-a000-00000000000a');
    raise exception 'FAIL: a member posted a photo as someone else';
  exception when insufficient_privilege then null;
  end;
  for i in 1..7 loop
    insert into public.listing_photos (board_id, listing_id) values (v_board, v_listing);
  end loop;
  begin
    insert into public.listing_photos (board_id, listing_id) values (v_board, v_listing);
    raise exception 'FAIL: a place took a 9th photo';
  exception when check_violation then null;
  end;
  raise notice 'PASS: members add photos (as themselves, indexed, up to 8)';
end $$;

-- Olive (outsider) can't see, add or remove any of them.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}';
do $$
declare
  v_board uuid := (select v from t where k = 'board');
  v_listing uuid := (select v from t where k = 'photo_listing');
  n int;
begin
  if (select count(*) from public.listing_photos where board_id = v_board) <> 0 then
    raise exception 'FAIL: outsider can see photo rows';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'tour-photos' and name like v_board || '/%') <> 0 then
    raise exception 'FAIL: outsider can see photo files';
  end if;
  begin
    insert into public.listing_photos (board_id, listing_id) values (v_board, v_listing);
    raise exception 'FAIL: outsider added a photo row';
  exception when insufficient_privilege then null;
  end;
  -- (Storage forbids direct SQL deletes; its delete policy uses the same
  -- membership check as reads, which the file count above covers.)
  delete from public.listing_photos where board_id = v_board;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: outsider deleted photo rows'; end if;
  raise notice 'PASS: outsider is refused tour photos';
end $$;

-- Member management. Bob (member) can't remove the owner, take the board or rename it.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
do $$
declare
  v_board uuid := (select v from t where k = 'board');
  n int;
begin
  delete from public.board_members where board_id = v_board and user_id = '00000000-0000-4000-a000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a member removed the owner'; end if;
  begin
    perform public.transfer_board_ownership(v_board, '00000000-0000-4000-a000-00000000000b');
    raise exception 'FAIL: a member took ownership';
  exception when insufficient_privilege then null;
  end;
  update public.boards set name = 'Bob was here' where id = v_board;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a member renamed the board'; end if;
  -- Before he's removed, Bob takes a next step and makes an invite link.
  update public.listings set next_action_assignee = '00000000-0000-4000-a000-00000000000b' where board_id = v_board;
  with i as (insert into public.invites (board_id) values (v_board) returning token)
  insert into t select 'bob_invite', token from i;
  raise notice 'PASS: a member can''t remove the owner, take the board or rename it';
end $$;

-- Alice (owner) can't walk away from the board, but can remove Bob. His next
-- step goes back to unassigned and his invite link stops working.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
do $$
declare
  v_board uuid := (select v from t where k = 'board');
  n int;
begin
  delete from public.board_members where board_id = v_board and user_id = '00000000-0000-4000-a000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: the owner left without handing the board over'; end if;
  delete from public.board_members where board_id = v_board and user_id = '00000000-0000-4000-a000-00000000000b';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the owner could not remove a member'; end if;
  if exists (select 1 from public.listings where board_id = v_board and next_action_assignee is not null) then
    raise exception 'FAIL: a removed member kept their next step';
  end if;
  if not (select revoked from public.invites where token = (select v from t where k = 'bob_invite')) then
    raise exception 'FAIL: a removed member''s invite link still works';
  end if;
  raise notice 'PASS: the owner removes members; their next steps and invite links are cleared';
end $$;

-- Removed, Bob sees nothing; with a fresh invite he can rejoin.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
do $$
declare
  v_board uuid := (select v from t where k = 'board');
begin
  if (select count(*) from public.listings where board_id = v_board) <> 0 then
    raise exception 'FAIL: a removed member can still read listings';
  end if;
  begin
    perform public.redeem_invite((select v from t where k = 'bob_invite'), 'Bob');
    raise exception 'FAIL: a removed member rejoined with his own old link';
  exception when raise_exception then
    if sqlerrm <> 'invite_revoked' then raise; end if;
  end;
  perform public.redeem_invite((select v from t where k = 'invite'), 'Bob');
  raise notice 'PASS: a removed member loses access and needs a working invite to return';
end $$;

-- Alice hands the board to Bob, then leaves.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
do $$
declare
  v_board uuid := (select v from t where k = 'board');
  n int;
begin
  perform public.transfer_board_ownership(v_board, '00000000-0000-4000-a000-00000000000b');
  if (select role from public.board_members where board_id = v_board and user_id = '00000000-0000-4000-a000-00000000000b') <> 'owner'
    or (select count(*) from public.board_members where board_id = v_board and role = 'owner') <> 1 then
    raise exception 'FAIL: ownership did not move to exactly one new owner';
  end if;
  delete from public.board_members where board_id = v_board and user_id = '00000000-0000-4000-a000-00000000000a';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the former owner could not leave'; end if;
  if (select count(*) from public.boards where id = v_board) <> 0 then
    raise exception 'FAIL: someone who left can still see the board';
  end if;
  raise notice 'PASS: the owner hands the board over and can then leave';
end $$;

-- Bob, now the owner, renames the board and then deletes it.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
do $$
declare
  v_board uuid := (select v from t where k = 'board');
  n int;
begin
  update public.boards set name = 'Renamed by the new owner' where id = v_board;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the new owner could not rename the board'; end if;
  delete from public.boards where id = v_board;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the owner could not delete the board'; end if;
  raise notice 'PASS: the new owner manages and deletes the board';
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
    perform 1 from public.listing_photos limit 1;
    raise exception 'FAIL: anon can query photos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_board('x', 'x');
    raise exception 'FAIL: anon can call create_board';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.transfer_board_ownership(gen_random_uuid(), gen_random_uuid());
    raise exception 'FAIL: anon can call transfer_board_ownership';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: anon has no access';
end $$;

reset role;
select 'ALL RLS CHECKS PASSED' as result;
rollback;
