-- Phase 1: profiles, books, shelf entries + RLS.

create type shelf_status as enum ('read', 'reading', 'want');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 50),
  is_public boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Public read of non-sensitive columns. Usernames of private profiles stay visible;
-- only their shelves are hidden.
create policy "profiles are readable by everyone"
  on profiles for select
  to anon, authenticated
  using (true);

create policy "users create their own profile"
  on profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "users update their own profile"
  on profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column-level privileges: clients never see or write is_admin (service role only).
-- Clients must select explicit columns from profiles (select('*') is denied).
revoke all on table profiles from anon, authenticated;
grant select (id, username, display_name, is_public, created_at) on table profiles to anon, authenticated;
grant insert (id, username, display_name, is_public) on table profiles to authenticated;
grant update (username, display_name, is_public) on table profiles to authenticated;

-- ---------------------------------------------------------------------------
-- books
-- ---------------------------------------------------------------------------
create table books (
  id uuid primary key default gen_random_uuid(),
  ol_work_id text unique,            -- e.g. OL45883W
  wikidata_id text unique,           -- e.g. Q208460
  title text not null,
  authors text[] not null default '{}',
  first_publish_year int,
  cover_id int,                      -- Open Library cover id
  description text,
  setting_checked_at timestamptz,    -- last Wikidata lookup
  created_at timestamptz default now()
);

alter table books enable row level security;

create policy "books are readable by everyone"
  on books for select
  to anon, authenticated
  using (true);

-- Writes only from server code using the service role.
revoke insert, update, delete, truncate on table books from anon, authenticated;

-- ---------------------------------------------------------------------------
-- shelf_entries
-- ---------------------------------------------------------------------------
create table shelf_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  book_id uuid not null references books on delete cascade,
  status shelf_status not null default 'read',
  rating smallint check (rating between 1 and 5),
  finished_on date,
  created_at timestamptz default now(),
  unique (user_id, book_id)
);

create index shelf_entries_book_id_idx on shelf_entries (book_id);

alter table shelf_entries enable row level security;

create policy "owners and public-profile visitors read shelf entries"
  on shelf_entries for select
  to anon, authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from profiles p
      where p.id = shelf_entries.user_id and p.is_public
    )
  );

create policy "owners insert shelf entries"
  on shelf_entries for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "owners update shelf entries"
  on shelf_entries for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "owners delete shelf entries"
  on shelf_entries for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Anonymous visitors may only read (public profiles); never write.
revoke insert, update, delete, truncate on table shelf_entries from anon;
