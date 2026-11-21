-- Phase 3: explore (bounding-box pins), place search, and paginated book lists.
-- All functions are security invoker, so RLS still applies (only approved links are public).

-- Bounding-box queries use planar geometry (a lng/lat box), not geodesic geography.
create index places_geom_geometry_idx on places using gist ((geom::extensions.geometry));
create index book_places_approved_place_idx on book_places (place_id) where status = 'approved';

-- ---------------------------------------------------------------------------
-- explore_places: pinnable places (point/city) inside a lng/lat box that have approved
-- books, most-read places first, capped at 2,000. The caller splits boxes that cross
-- the antimeridian.
-- ---------------------------------------------------------------------------
create function explore_places(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_features integer default 2000
)
returns table (
  place_id uuid,
  name text,
  country_code text,
  lng double precision,
  lat double precision,
  book_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.country_code::text,
    extensions.st_x(p.geom::extensions.geometry),
    extensions.st_y(p.geom::extensions.geometry),
    count(distinct bp.book_id)::integer
  from public.places p
  join public.book_places bp on bp.place_id = p.id and bp.status = 'approved'
  where p.precision in ('point', 'city')
    and p.geom is not null
    and p.geom::extensions.geometry
      operator(extensions.&&) extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  group by p.id
  order by count(distinct bp.book_id) desc, p.id
  limit least(greatest(max_features, 0), 2000);
$$;

grant execute on function explore_places(double precision, double precision, double precision, double precision, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- search_places: places with approved books whose name matches, for "jump to a place".
-- ---------------------------------------------------------------------------
create function search_places(q text, max_results integer default 8)
returns table (
  place_id uuid,
  name text,
  "precision" public.location_precision,
  country_code text,
  lng double precision,
  lat double precision,
  book_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.precision,
    p.country_code::text,
    extensions.st_x(p.geom::extensions.geometry),
    extensions.st_y(p.geom::extensions.geometry),
    count(distinct bp.book_id)::integer
  from public.places p
  join public.book_places bp on bp.place_id = p.id and bp.status = 'approved'
  where p.precision <> 'fictional'
    and p.name ilike '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  group by p.id
  order by
    (lower(p.name) = lower(q)) desc,
    (p.name ilike replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%') desc,
    count(distinct bp.book_id) desc,
    p.name
  limit least(greatest(max_results, 0), 20);
$$;

grant execute on function search_places(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Paginated book lists. `total` repeats the full count on every row.
-- ---------------------------------------------------------------------------
create function books_at_place(p_place_id uuid, p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid,
  ol_work_id text,
  title text,
  authors text[],
  first_publish_year integer,
  cover_id integer,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.id, b.ol_work_id, b.title, b.authors, b.first_publish_year, b.cover_id, count(*) over ()
  from public.book_places bp
  join public.books b on b.id = bp.book_id
  where bp.place_id = p_place_id and bp.status = 'approved'
  order by b.title, b.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

grant execute on function books_at_place(uuid, integer, integer) to anon, authenticated;

-- Books with any approved, real (non-fictional) setting in a country.
create function books_in_country(p_country_code text, p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid,
  ol_work_id text,
  title text,
  authors text[],
  first_publish_year integer,
  cover_id integer,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matches as (
    select distinct b.id, b.ol_work_id, b.title, b.authors, b.first_publish_year, b.cover_id
    from public.places p
    join public.book_places bp on bp.place_id = p.id and bp.status = 'approved'
    join public.books b on b.id = bp.book_id
    where p.country_code = upper(p_country_code) and p.precision <> 'fictional'
  )
  select m.*, count(*) over () from matches m
  order by m.title, m.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

grant execute on function books_in_country(text, integer, integer) to anon, authenticated;

-- One place with plain coordinates (for /place/[id]).
create function place_detail(p_place_id uuid)
returns table (
  id uuid,
  name text,
  "precision" public.location_precision,
  country_code text,
  wikidata_id text,
  lng double precision,
  lat double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.precision,
    p.country_code::text,
    p.wikidata_id,
    extensions.st_x(p.geom::extensions.geometry),
    extensions.st_y(p.geom::extensions.geometry)
  from public.places p
  where p.id = p_place_id;
$$;

grant execute on function place_detail(uuid) to anon, authenticated;

-- book_place_coords: add a unique tiebreaker so callers can page past the API's
-- 1,000-row limit with stable results (two places can share a name).
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
  order by bp.book_id, p.name, p.id;
$$;

-- When the book's Open Library metadata (cover, description, year, authors) was last
-- fetched. Seeded books start null and are enriched the first time a reader adds them.
alter table books add column metadata_checked_at timestamptz;
-- Books readers already added were created from Open Library metadata.
update books set metadata_checked_at = created_at where description is not null or cover_id is not null;
