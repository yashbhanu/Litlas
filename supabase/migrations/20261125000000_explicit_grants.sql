-- Explicit privileges for the API roles.
--
-- Newer hosted Supabase projects no longer grant anon/authenticated/service_role access
-- to new tables in `public` by default (the local CLI still does). Earlier migrations
-- relied on those defaults and only revoked what clients must not do, so on hosted every
-- table except `profiles` (explicit column grants) failed with "permission denied".
-- This grants exactly the privileges the local stack ends up with. RLS still decides
-- which rows each role sees. Idempotent: re-granting an existing privilege is a no-op.

-- Server role: full access to every table (it bypasses RLS for server-owned writes).
grant select, insert, update, delete, truncate, references, trigger
  on table profiles, books, shelf_entries, places, book_places, location_votes, rate_limits
  to service_role;

-- Public read-only catalogue.
grant select on table books, places, book_places to anon, authenticated;

-- Shelves: readable by everyone (RLS hides private profiles), written by their owner.
grant select on table shelf_entries to anon;
grant select, insert, update, delete on table shelf_entries to authenticated;

-- Votes: readable by everyone, cast or withdrawn by signed-in readers.
grant select on table location_votes to anon;
grant select, insert, delete on table location_votes to authenticated;

-- rate_limits stays private to the server (no client grants).

-- Functions that were revoked from public: the server still needs them.
grant execute on function apply_location_approval(uuid) to service_role;
grant execute on function location_votes_after_insert() to service_role;
grant execute on function merge_places(uuid, uuid) to service_role;
grant execute on function moderation_queue(integer) to service_role;
grant execute on function place_duplicates(uuid, integer) to service_role;
grant execute on function consume_rate_limit(text, integer) to authenticated, service_role;
