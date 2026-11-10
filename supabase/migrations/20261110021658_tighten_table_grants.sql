-- The project's default privileges give `authenticated` every privilege on new
-- public tables, which overrides the column-level grants in the previous
-- migration (a member could set their own role, or move a listing's board_id).
-- RLS still kept outsiders out; this restores least privilege for members.

revoke all on public.boards, public.board_members, public.invites, public.listings from authenticated;

grant select, delete on public.boards to authenticated;
grant update (name, lease_year, budget_per_person_cents) on public.boards to authenticated;

grant select, delete on public.board_members to authenticated;
grant update (display_name) on public.board_members to authenticated;

grant select on public.invites to authenticated;
grant insert (board_id) on public.invites to authenticated;
grant update (revoked) on public.invites to authenticated;

grant select, delete on public.listings to authenticated;
grant insert (
  board_id, title, address, url, rent_cents, beds, baths, lease_start, lease_end, parking, laundry,
  lat, lng, status, starred, notes, next_action, next_action_assignee, next_action_due
) on public.listings to authenticated;
grant update (
  title, address, url, rent_cents, beds, baths, lease_start, lease_end, parking, laundry,
  lat, lng, status, starred, notes, next_action, next_action_assignee, next_action_due
) on public.listings to authenticated;

-- Future tables in this schema start closed; each migration grants what it needs.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
