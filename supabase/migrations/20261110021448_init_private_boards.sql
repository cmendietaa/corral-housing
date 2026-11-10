-- Corral: private shared boards.
--
-- Access model: a user can read or write a board's data only while they are a
-- member of that board. Membership is the single rule behind every policy.
-- Nobody inserts into board_members directly; the only ways in are
-- create_board() (you become the owner) and redeem_invite() (you join).
--
-- Since Oct 2026, new public tables aren't exposed to the Data API by default,
-- so access is granted explicitly below, to `authenticated` only. `anon` gets nothing.

-- ---------------------------------------------------------------------------
-- Private schema for helpers used by policies (not exposed through the API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  lease_year text not null default '' check (char_length(lease_year) <= 20),
  budget_per_person_cents integer check (budget_per_person_cents >= 0),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index boards_created_by_idx on public.boards (created_by);

create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
-- The primary key covers lookups by board; this covers "my boards" and the policy helper.
create index board_members_user_id_idx on public.board_members (user_id, board_id);

create table public.invites (
  token uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index invites_board_id_idx on public.invites (board_id);
create index invites_created_by_idx on public.invites (created_by);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  address text check (char_length(address) <= 200),
  -- Only http(s) links, so a saved URL can never be a javascript: or data: link.
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  rent_cents integer check (rent_cents >= 0),
  beds numeric(4, 1) check (beds between 0 and 20),
  baths numeric(4, 1) check (baths between 0 and 20),
  lease_start date,
  lease_end date,
  parking text check (parking in ('garage', 'driveway', 'street', 'none')),
  laundry text check (laundry in ('in_unit', 'on_site', 'none')),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  status text not null default 'considering'
    check (status in ('considering', 'contacted', 'tour_scheduled', 'applied', 'passed', 'unavailable')),
  starred boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  -- One next action per place (PRD), stored on the listing.
  next_action text check (char_length(next_action) <= 200),
  next_action_assignee uuid references auth.users (id) on delete set null,
  next_action_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  check (lease_end is null or lease_start is null or lease_end >= lease_start)
);
create index listings_board_id_idx on public.listings (board_id, created_at desc);
create index listings_next_action_assignee_idx on public.listings (next_action_assignee);
create index listings_updated_by_idx on public.listings (updated_by);

-- ---------------------------------------------------------------------------
-- Policy helpers (security definer so they can read board_members without
-- recursing into its own policy; they only ever answer about the caller)
-- ---------------------------------------------------------------------------
create or replace function private.is_board_member(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.board_members m
    where m.board_id = p_board_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_board_owner(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.board_members m
    where m.board_id = p_board_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

revoke all on function private.is_board_member(uuid) from public, anon;
revoke all on function private.is_board_owner(uuid) from public, anon;
-- Policies run as the signed-in user, so `authenticated` must be able to call these.
grant execute on function private.is_board_member(uuid) to authenticated;
grant execute on function private.is_board_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Listing triggers: stamp updates, and keep the assignee on the board
-- ---------------------------------------------------------------------------
create or replace function private.listings_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if new.next_action_assignee is not null and not exists (
    select 1 from public.board_members m
    where m.board_id = new.board_id and m.user_id = new.next_action_assignee
  ) then
    raise exception 'The person assigned to the next step is not on this board.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.listings_before_write() from public, anon, authenticated;

create trigger listings_before_write
before insert or update on public.listings
for each row execute function private.listings_before_write();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.invites enable row level security;
alter table public.listings enable row level security;

-- boards: members read; the owner renames or deletes. Created only via create_board().
create policy "Members can read their boards" on public.boards
  for select to authenticated
  using ((select private.is_board_member(id)));
create policy "Owners can update their boards" on public.boards
  for update to authenticated
  using ((select private.is_board_owner(id)))
  with check ((select private.is_board_owner(id)));
create policy "Owners can delete their boards" on public.boards
  for delete to authenticated
  using ((select private.is_board_owner(id)));

-- board_members: members see who else is on the board; you can rename yourself;
-- you can leave, and the owner can remove people. Joined only via the functions.
create policy "Members can read the member list" on public.board_members
  for select to authenticated
  using ((select private.is_board_member(board_id)));
create policy "Members can rename themselves" on public.board_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Members can leave, owners can remove" on public.board_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_board_owner(board_id)));

-- invites: any member can create, see and turn off invites for their board.
create policy "Members can read invites" on public.invites
  for select to authenticated
  using ((select private.is_board_member(board_id)));
create policy "Members can create invites" on public.invites
  for insert to authenticated
  with check ((select private.is_board_member(board_id)) and created_by = (select auth.uid()));
create policy "Members can revoke invites" on public.invites
  for update to authenticated
  using ((select private.is_board_member(board_id)))
  with check ((select private.is_board_member(board_id)));

-- listings: members have full access to their board's places.
create policy "Members can read listings" on public.listings
  for select to authenticated
  using ((select private.is_board_member(board_id)));
create policy "Members can add listings" on public.listings
  for insert to authenticated
  with check ((select private.is_board_member(board_id)));
create policy "Members can update listings" on public.listings
  for update to authenticated
  using ((select private.is_board_member(board_id)))
  with check ((select private.is_board_member(board_id)));
create policy "Members can delete listings" on public.listings
  for delete to authenticated
  using ((select private.is_board_member(board_id)));

-- ---------------------------------------------------------------------------
-- Grants (least privilege; column grants stop moving rows between boards or
-- promoting yourself to owner)
-- ---------------------------------------------------------------------------
revoke all on public.boards, public.board_members, public.invites, public.listings from anon, public;

grant select, delete on public.boards to authenticated;
grant update (name, lease_year, budget_per_person_cents) on public.boards to authenticated;

grant select, delete on public.board_members to authenticated;
grant update (display_name) on public.board_members to authenticated;

grant select on public.invites to authenticated;
grant insert (board_id) on public.invites to authenticated;
grant update (revoked) on public.invites to authenticated;

grant select, insert, delete on public.listings to authenticated;
grant update (
  title, address, url, rent_cents, beds, baths, lease_start, lease_end, parking, laundry,
  lat, lng, status, starred, notes, next_action, next_action_assignee, next_action_due
) on public.listings to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs: the only ways into board_members
-- ---------------------------------------------------------------------------

-- Create a board and become its owner. Returns the new board's id.
create or replace function public.create_board(
  p_name text,
  p_display_name text,
  p_lease_year text default '',
  p_budget_per_person_cents integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_board_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to create a board.' using errcode = '42501';
  end if;

  insert into public.boards (name, lease_year, budget_per_person_cents, created_by)
  values (btrim(p_name), coalesce(btrim(p_lease_year), ''), p_budget_per_person_cents, v_uid)
  returning id into v_board_id;

  insert into public.board_members (board_id, user_id, display_name, role)
  values (v_board_id, v_uid, btrim(p_display_name), 'owner');

  return v_board_id;
end;
$$;

-- What an invite link points to, before joining. Only reveals the board's name,
-- and only to someone holding the (unguessable) token.
create or replace function public.invite_preview(p_token uuid)
returns table (board_id uuid, board_name text, state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in to see this invite.' using errcode = '42501';
  end if;

  return query
  select
    i.board_id,
    b.name,
    case
      when exists (
        select 1 from public.board_members m where m.board_id = i.board_id and m.user_id = v_uid
      ) then 'member'
      when i.revoked then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'valid'
    end
  from public.invites i
  join public.boards b on b.id = i.board_id
  where i.token = p_token;
end;
$$;

-- Join a board with an invite. Returns the board id, or fails with a clear reason.
create or replace function public.redeem_invite(p_token uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in to join a board.' using errcode = '42501';
  end if;

  select * into v_invite from public.invites where token = p_token for update;

  if not found then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;
  if v_invite.revoked then
    raise exception 'invite_revoked' using errcode = 'P0001';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  insert into public.board_members (board_id, user_id, display_name, role)
  values (v_invite.board_id, v_uid, btrim(p_display_name), 'member')
  on conflict (board_id, user_id) do nothing;

  return v_invite.board_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; these are for signed-in users only.
revoke all on function public.create_board(text, text, text, integer) from public, anon;
revoke all on function public.invite_preview(uuid) from public, anon;
revoke all on function public.redeem_invite(uuid, text) from public, anon;
grant execute on function public.create_board(text, text, text, integer) to authenticated;
grant execute on function public.invite_preview(uuid) to authenticated;
grant execute on function public.redeem_invite(uuid, text) to authenticated;
