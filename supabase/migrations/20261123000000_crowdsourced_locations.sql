-- Phase 4: crowdsourced locations — votes, the approval function, rate limits, moderation.

-- ---------------------------------------------------------------------------
-- Approval threshold (mirrored in lib/locations/constants.ts; a test checks they match)
-- ---------------------------------------------------------------------------
create function approval_threshold()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3 $$;

grant execute on function approval_threshold() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- book_places visibility: pending suggestions are public so other readers can confirm
-- them (the spec's "users read their own pending rows" would hide them from voters).
-- Rejected suggestions stay visible only to whoever made them.
-- ---------------------------------------------------------------------------
drop policy "approved links and own suggestions are readable" on book_places;

create policy "approved and pending links, and own suggestions, are readable"
  on book_places for select
  to anon, authenticated
  using (status in ('approved', 'pending') or created_by = (select auth.uid()));

create index book_places_pending_idx on book_places (created_at) where status = 'pending';
create index places_osm_id_idx on places (osm_id) where osm_id is not null;

-- ---------------------------------------------------------------------------
-- location_votes
-- ---------------------------------------------------------------------------
create table location_votes (
  book_place_id uuid references book_places on delete cascade,
  user_id uuid references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (book_place_id, user_id)
);

create index location_votes_user_id_idx on location_votes (user_id);

alter table location_votes enable row level security;

create policy "users read their own votes"
  on location_votes for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Users vote as themselves, only on pending suggestions, and never on their own. The
-- suggester's own vote is recorded by the server (service role) when they suggest.
-- Voting twice is impossible: (book_place_id, user_id) is the primary key.
create policy "users vote on other readers' pending suggestions"
  on location_votes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from book_places bp
      where bp.id = location_votes.book_place_id
        and bp.status = 'pending'
        and bp.created_by is distinct from (select auth.uid())
    )
  );

create policy "users withdraw their votes on pending suggestions"
  on location_votes for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from book_places bp
      where bp.id = location_votes.book_place_id and bp.status = 'pending'
    )
  );

revoke update, truncate on table location_votes from anon, authenticated;
revoke insert, delete on table location_votes from anon;

-- ---------------------------------------------------------------------------
-- Approval: after each vote, a pending link with approval_threshold() votes becomes
-- approved. Security definer because clients can't update book_places.
-- ---------------------------------------------------------------------------
create function apply_location_approval(p_book_place_id uuid)
returns public.link_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.link_status;
begin
  update public.book_places
  set status = 'approved'
  where id = p_book_place_id
    and status = 'pending'
    and (select count(*) from public.location_votes v where v.book_place_id = p_book_place_id)
      >= public.approval_threshold();

  select status into result from public.book_places where id = p_book_place_id;
  return result;
end;
$$;

revoke execute on function apply_location_approval(uuid) from public, anon, authenticated;

create function location_votes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_location_approval(new.book_place_id);
  return null;
end;
$$;

revoke execute on function location_votes_after_insert() from public, anon, authenticated;

create trigger location_votes_apply_approval
  after insert on location_votes
  for each row execute function location_votes_after_insert();

-- ---------------------------------------------------------------------------
-- pending_suggestions: a book's pending suggestions with vote counts and whether the
-- caller made or confirmed each one. Security definer so counts include every vote
-- (votes themselves are private).
-- ---------------------------------------------------------------------------
create function pending_suggestions(p_book_id uuid)
returns table (
  book_place_id uuid,
  place_id uuid,
  name text,
  "precision" public.location_precision,
  country_code text,
  created_at timestamptz,
  votes integer,
  mine boolean,
  voted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    bp.id,
    p.id,
    p.name,
    p.precision,
    p.country_code::text,
    bp.created_at,
    (select count(*)::integer from public.location_votes v where v.book_place_id = bp.id),
    coalesce(bp.created_by = (select auth.uid()), false),
    exists (
      select 1 from public.location_votes v
      where v.book_place_id = bp.id and v.user_id = (select auth.uid())
    )
  from public.book_places bp
  join public.places p on p.id = bp.place_id
  where bp.book_id = p_book_id and bp.status = 'pending'
  order by bp.created_at, bp.id;
$$;

grant execute on function pending_suggestions(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rate limits: a per-user, per-action, per-day counter. No client access to the table;
-- consume_rate_limit() counts one use and says whether the caller is within the limit.
-- ---------------------------------------------------------------------------
create table rate_limits (
  user_id uuid not null references auth.users on delete cascade,
  action text not null check (action ~ '^[a-z_]{1,40}$'),
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (user_id, action, day)
);

alter table rate_limits enable row level security;
revoke all on table rate_limits from anon, authenticated;

create function consume_rate_limit(p_action text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  used integer;
begin
  if uid is null then
    return false;
  end if;
  insert into public.rate_limits as r (user_id, action, day, count)
  values (uid, p_action, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, action, day) do update set count = r.count + 1
  returning r.count into used;
  return used <= p_max;
end;
$$;

revoke execute on function consume_rate_limit(text, integer) from public, anon;
grant execute on function consume_rate_limit(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Moderation (service role only)
-- ---------------------------------------------------------------------------

-- Merge a duplicate place into another: links move over (votes too, and a link that
-- exists on both keeps the better status), then the duplicate is deleted.
create function merge_places(p_from uuid, p_into uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved integer := 0;
  link record;
  target_id uuid;
begin
  if p_from = p_into then
    raise exception 'cannot merge a place into itself';
  end if;
  if not exists (select 1 from public.places where id = p_into) then
    raise exception 'target place % not found', p_into;
  end if;

  for link in select * from public.book_places where place_id = p_from loop
    select id into target_id from public.book_places
    where book_id = link.book_id and place_id = p_into;

    if target_id is null then
      update public.book_places set place_id = p_into where id = link.id;
    else
      insert into public.location_votes (book_place_id, user_id, created_at)
      select target_id, v.user_id, v.created_at from public.location_votes v
      where v.book_place_id = link.id
      on conflict do nothing;
      update public.book_places
      set status = case
        when status = 'approved' or link.status = 'approved' then 'approved'::public.link_status
        when status = 'pending' or link.status = 'pending' then 'pending'::public.link_status
        else 'rejected'::public.link_status
      end
      where id = target_id;
      delete from public.book_places where id = link.id;
      perform public.apply_location_approval(target_id);
    end if;
    moved := moved + 1;
  end loop;

  delete from public.places where id = p_from;
  return moved;
end;
$$;

revoke execute on function merge_places(uuid, uuid) from public, anon, authenticated;

-- Moderation queue: pending suggestions, oldest first, with votes and the suggester.
create function moderation_queue(p_limit integer default 50)
returns table (
  book_place_id uuid,
  book_id uuid,
  book_title text,
  place_id uuid,
  place_name text,
  "precision" public.location_precision,
  country_code text,
  lng double precision,
  lat double precision,
  suggested_by text,
  created_at timestamptz,
  votes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    bp.id, b.id, b.title, p.id, p.name, p.precision, p.country_code::text,
    extensions.st_x(p.geom::extensions.geometry),
    extensions.st_y(p.geom::extensions.geometry),
    pr.username, bp.created_at,
    (select count(*)::integer from public.location_votes v where v.book_place_id = bp.id)
  from public.book_places bp
  join public.books b on b.id = bp.book_id
  join public.places p on p.id = bp.place_id
  left join public.profiles pr on pr.id = bp.created_by
  where bp.status = 'pending'
  order by bp.created_at, bp.id
  limit least(greatest(p_limit, 1), 200);
$$;

revoke execute on function moderation_queue(integer) from public, anon, authenticated;

-- Possible duplicates of a place: same name (case-insensitive), or the same precision
-- within 25 km. Used by the moderation queue's "Merge into" options.
create function place_duplicates(p_place_id uuid, p_limit integer default 5)
returns table (
  id uuid,
  name text,
  "precision" public.location_precision,
  country_code text,
  source text,
  links integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    other.id, other.name, other.precision, other.country_code::text,
    case when other.wikidata_id is not null then 'wikidata' else 'readers' end,
    (select count(*)::integer from public.book_places bp
      where bp.place_id = other.id and bp.status = 'approved')
  from public.places me
  join public.places other on other.id <> me.id
  where me.id = p_place_id
    and (
      lower(other.name) = lower(me.name)
      or (
        other.precision = me.precision
        and me.geom is not null and other.geom is not null
        and extensions.st_dwithin(me.geom, other.geom, 25000)
      )
      or (
        me.precision = 'country' and other.precision = 'country'
        and other.country_code = me.country_code
      )
    )
  order by (lower(other.name) = lower(me.name)) desc, other.wikidata_id is null, other.name
  limit least(greatest(p_limit, 1), 20);
$$;

revoke execute on function place_duplicates(uuid, integer) from public, anon, authenticated;
