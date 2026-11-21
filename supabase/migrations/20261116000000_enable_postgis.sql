-- Phase 0: enable PostGIS for geo queries (places.geom, bbox lookups).
-- Installed into the `extensions` schema per Supabase convention; its types and
-- functions are on the default search_path.
create extension if not exists postgis with schema extensions;
