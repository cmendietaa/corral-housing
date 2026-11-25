-- Photo choices per place, shared by the whole board:
--   cover_photo: which photo leads. 'street' for Street View, a listing_photos
--                id, or null to pick automatically (first added photo, else Street View).
--   street_view: false hides Street View for this place.
-- A cover id that no longer exists (photo removed) falls back to automatic in the app.
alter table public.listings
  add column cover_photo text
    check (cover_photo is null or cover_photo = 'street' or cover_photo ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  add column street_view boolean not null default true;

-- Members already update listings through column grants; add the two new columns.
grant insert (cover_photo, street_view) on public.listings to authenticated;
grant update (cover_photo, street_view) on public.listings to authenticated;
