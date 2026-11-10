-- Live updates: stream listing and member changes to subscribed members.
-- Realtime checks each subscriber's RLS SELECT policy, so outsiders get nothing.
alter publication supabase_realtime add table public.listings, public.board_members;
-- Deletes carry the full old row so the board_id filter can match them.
alter table public.listings replica identity full;
