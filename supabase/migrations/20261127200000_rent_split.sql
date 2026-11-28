-- Rent splitting: how a place's price is quoted, how many people would live
-- there, how the rent is split, and how big the group is.
--
--   listings.price_basis   'whole' (the rent for the whole place, the default),
--                          'per_person' (each person pays this), or 'our_part'
--                          (a sublet or one room: the price is what the group pays).
--   listings.people_count  How many people would live there. Null means the
--                          group's size; more than the group means spots to fill.
--   listings.split         How the rent is split. Null means not decided yet
--                          (the app shows a range). Otherwise a small object,
--                          checked by the app, e.g. {"mode": "custom", "shares": [...]}.
--   boards.group_size      How many people are in the group. Null means the
--                          number of members (not every roommate joins the board).

alter table public.listings
  add column price_basis text not null default 'whole'
    check (price_basis in ('whole', 'per_person', 'our_part')),
  add column people_count smallint
    check (people_count between 1 and 20),
  add column split jsonb
    check (split is null or (jsonb_typeof(split) = 'object' and octet_length(split::text) <= 4000));

alter table public.boards
  add column group_size smallint
    check (group_size between 1 and 20);

-- Members write listings and boards through column grants; add the new columns.
grant insert (price_basis, people_count, split) on public.listings to authenticated;
grant update (price_basis, people_count, split) on public.listings to authenticated;
grant update (group_size) on public.boards to authenticated;
