-- A place can be saved without a listing link: screenshots from Instagram or
-- a group chat, and word-of-mouth places, often don't have one. The existing
-- check (http(s) only, at most 2000 characters) still applies whenever a link
-- is given; a CHECK passes on NULL, so it doesn't need to change.
alter table public.listings alter column url drop not null;
