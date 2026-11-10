-- Tour photos: roommates add up to 8 photos per place. Files live in a private
-- Storage bucket at <board_id>/<listing_id>/<photo_id>.jpg; this table is the
-- index (order, uploader, live updates). Only board members can read, add or
-- remove either one.

-- A photo's listing must be on the photo's board (composite foreign key).
alter table public.listings add constraint listings_id_board_key unique (id, board_id);

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  listing_id uuid not null,
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- The storage path is derived, never chosen by the client.
  path text generated always as (board_id::text || '/' || listing_id::text || '/' || id::text || '.jpg') stored unique,
  foreign key (listing_id, board_id) references public.listings (id, board_id) on delete cascade
);

create index listing_photos_listing_idx on public.listing_photos (listing_id, created_at);
create index listing_photos_board_idx on public.listing_photos (board_id);

alter table public.listing_photos enable row level security;

create policy "Members read their boards' photos"
  on public.listing_photos for select to authenticated
  using ((select private.is_board_member(board_id)));

create policy "Members add photos as themselves"
  on public.listing_photos for insert to authenticated
  with check ((select private.is_board_member(board_id)) and uploaded_by = (select auth.uid()));

create policy "Members remove their boards' photos"
  on public.listing_photos for delete to authenticated
  using ((select private.is_board_member(board_id)));

grant select, delete on public.listing_photos to authenticated;
grant insert (id, board_id, listing_id) on public.listing_photos to authenticated;

-- At most 8 photos per place.
create or replace function private.listing_photos_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.listing_photos p where p.listing_id = new.listing_id) >= 8 then
    raise exception 'A place can have up to 8 photos.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger listing_photos_cap
  before insert on public.listing_photos
  for each row execute function private.listing_photos_cap();

-- Storage: a private bucket for JPEGs up to 2 MB (the browser shrinks photos first).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tour-photos', 'tour-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Is the signed-in user a member of the board named by a storage path's first folder?
create or replace function private.is_member_of_photo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.board_members m
    where m.board_id::text = (storage.foldername(p_name))[1] and m.user_id = (select auth.uid())
  );
$$;

create policy "Members read tour photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'tour-photos' and (select private.is_member_of_photo_path(name)));

-- Uploads only to a path that already has a photo row, so the table and bucket
-- stay in step and nobody can drop arbitrary files into the bucket.
create policy "Members upload tour photos they indexed"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tour-photos'
    and (select private.is_member_of_photo_path(name))
    and exists (select 1 from public.listing_photos p where p.path = name)
  );

create policy "Members delete tour photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tour-photos' and (select private.is_member_of_photo_path(name)));

-- Live updates for photos.
alter publication supabase_realtime add table public.listing_photos;
alter table public.listing_photos replica identity full;
