-- Phase 2: places, book_places + RLS, and a coordinates helper for maps.

create type location_precision as enum ('point', 'city', 'region', 'country', 'fictional');
create type location_source as enum ('wikidata', 'user', 'admin');
create type link_status as enum ('approved', 'pending', 'rejected');

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------
create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wikidata_id text unique,
  osm_id text,
  precision location_precision not null,
  geom extensions.geography(Point, 4326),  -- null for country-only or fictional
  country_code char(2) check (country_code ~ '^[A-Z]{2}$'),  -- ISO 3166-1 alpha-2
  created_at timestamptz default now()
);

create index places_geom_idx on places using gist (geom);
create index places_country_code_idx on places (country_code);

alter table places enable row level security;

create policy "places are readable by everyone"
  on places for select
  to anon, authenticated
  using (true);

-- Writes only from server code using the service role.
revoke insert, update, delete, truncate on table places from anon, authenticated;

-- ---------------------------------------------------------------------------
-- book_places
-- ---------------------------------------------------------------------------
create table book_places (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books on delete cascade,
  place_id uuid not null references places on delete cascade,
  source location_source not null,
  status link_status not null default 'pending',
  created_by uuid references profiles on delete set null,
  created_at timestamptz default now(),
  unique (book_id, place_id)
);

create index book_places_place_id_idx on book_places (place_id);
create index book_places_status_idx on book_places (status);

alter table book_places enable row level security;

-- Approved links are public; users also see their own pending/rejected suggestions.
create policy "approved links and own suggestions are readable"
  on book_places for select
  to anon, authenticated
  using (status = 'approved' or created_by = (select auth.uid()));

-- Inserts go through the API (service role), never directly from clients.
revoke insert, update, delete, truncate on table book_places from anon, authenticated;

-- ---------------------------------------------------------------------------
-- book_place_coords: places of the given books with plain lng/lat, for map building.
-- Security invoker, so book_places RLS still applies (approved, or the caller's own).
-- Only approved links are returned.
-- ---------------------------------------------------------------------------
create function book_place_coords(p_book_ids uuid[])
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
  order by bp.book_id, p.name;
$$;

grant execute on function book_place_coords(uuid[]) to anon, authenticated;
