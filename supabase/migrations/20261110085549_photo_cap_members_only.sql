-- The photo cap runs before RLS's insert check, so an outsider hitting a full
-- place got "up to 8 photos" instead of a plain refusal (and learned the count).
-- Count only for members; RLS refuses everyone else.
create or replace function private.listing_photos_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_board_member(new.board_id)
     and (select count(*) from public.listing_photos p where p.listing_id = new.listing_id) >= 8 then
    raise exception 'A place can have up to 8 photos.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
