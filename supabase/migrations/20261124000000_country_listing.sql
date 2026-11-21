-- UI: country listings show where in the country each book is set, plus the country's
-- top places (filter chips) and how many places it has.

drop function books_in_country(text, integer, integer);

-- Books with any approved, real setting in a country. `places` lists the book's
-- settings in that country (cities and points first; a country-level setting is the
-- country itself).
create function books_in_country(p_country_code text, p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid,
  ol_work_id text,
  title text,
  authors text[],
  first_publish_year integer,
  cover_id integer,
  places text[],
  country_level boolean,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matches as (
    select
      b.id, b.ol_work_id, b.title, b.authors, b.first_publish_year, b.cover_id,
      array_agg(p.name order by (p.precision = 'country'), (p.precision = 'region'), p.name)
        filter (where p.precision <> 'country') as places,
      bool_or(p.precision = 'country') as country_level
    from public.places p
    join public.book_places bp on bp.place_id = p.id and bp.status = 'approved'
    join public.books b on b.id = bp.book_id
    where p.country_code = upper(p_country_code) and p.precision <> 'fictional'
    group by b.id
  )
  select
    m.id, m.ol_work_id, m.title, m.authors, m.first_publish_year, m.cover_id,
    coalesce(m.places, '{}'), m.country_level, count(*) over ()
  from matches m
  order by m.title, m.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

grant execute on function books_in_country(text, integer, integer) to anon, authenticated;

-- A country's places with approved books (cities, points, regions), most-read first.
-- `total` repeats the number of such places on every row.
create function country_places(p_country_code text, p_limit integer default 5)
returns table (
  place_id uuid,
  name text,
  "precision" public.location_precision,
  book_count integer,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.name, p.precision, count(distinct bp.book_id)::integer, count(*) over ()
  from public.places p
  join public.book_places bp on bp.place_id = p.id and bp.status = 'approved'
  where p.country_code = upper(p_country_code) and p.precision in ('city', 'point', 'region')
  group by p.id
  order by count(distinct bp.book_id) desc, p.name
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function country_places(text, integer) to anon, authenticated;

-- A book's places, most notable first: places with more approved books come first
-- (Dublin before Cabra for Ulysses). The unique tiebreaker keeps paging stable.
create or replace function book_place_coords(p_book_ids uuid[])
returns table (
  book_id uuid,
  place_id uuid,
  name text,
  "precision" location_precision,
  country_code text,
  source location_source,
  lng double precision,
  lat double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    bp.book_id,
    p.id,
    p.name,
    p.precision,
    p.country_code::text,
    bp.source,
    extensions.st_x(p.geom::extensions.geometry),
    extensions.st_y(p.geom::extensions.geometry)
  from public.book_places bp
  join public.places p on p.id = bp.place_id
  where bp.book_id = any (p_book_ids)
    and bp.status = 'approved'
  order by
    bp.book_id,
    (select count(*) from public.book_places other
      where other.place_id = p.id and other.status = 'approved') desc,
    p.name,
    p.id;
$$;
