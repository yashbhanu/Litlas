# Literary World Map — Build Spec for Claude Code

Nov 15, 2026 · @Yash Bhanushali

## Overview

Literary World Map is a free web app where readers log books and each book appears as a pin at the place its story is set. Readers build a personal "read around the world" map; anyone can explore a place and find novels set there.

**Goals**

- Personal map: log a book, see it pinned at its setting, see countries covered and stats.
- Explore: browse a world map of books by setting; click a place to see books set there.
- Crowdsourced data: when a book has no known setting, readers suggest one; suggestions become canonical once enough readers agree.
- Shareable public profile map with a social preview image.
- Runs on free tiers only (domain optional).

**Non-goals for v1**

- No native mobile app (responsive web only).
- No paid features, ads, or e-commerce links.
- No full social network: friends and feeds are a later phase.
- No AI features.

**How to use this doc with Claude Code**

Save this doc as `SPEC.md` in the repo root (download as Markdown). Work phase by phase from the Build phases section: ask Claude Code to implement one phase, verify its acceptance criteria, commit, then move on. A starter prompt is at the end.

## Tech stack and requirements

Everything below has a free tier sufficient for a hobby launch. Verify current free-tier limits before launch, since they change.

| Layer                  | Choice                                                                            | Notes                                               |
| ---------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| Framework              | Next.js (App Router) + TypeScript (strict)                                        | Server components for pages, route handlers for API |
| Styling                | Tailwind CSS + shadcn/ui                                                          | Light and dark mode                                 |
| Map                    | MapLibre GL JS via `react-map-gl/maplibre`                                        | Built-in clustering for pins                        |
| Map tiles              | OpenFreeMap vector tiles                                                          | No API key; Protomaps on Cloudflare R2 as fallback  |
| Country shapes         | Natural Earth admin-0 countries GeoJSON (simplified)                              | Bundled as a static asset for shading               |
| Database               | Supabase Postgres + PostGIS                                                       | Geo queries, Row Level Security                     |
| Auth                   | Supabase Auth                                                                     | Email magic link + Google OAuth                     |
| Data access            | Supabase JS client + generated TypeScript types                                   | Migrations via Supabase CLI                         |
| Validation             | Zod                                                                               | All API inputs and external API responses           |
| Data fetching (client) | TanStack Query                                                                    | Caching, loading states                             |
| Book metadata          | Open Library Search + Works API, Covers API                                       | Free, no key; set a descriptive User-Agent          |
| Book settings          | Wikidata SPARQL endpoint (P840 narrative location, P625 coordinates, P17 country) | Free; cache results                                 |
| Geocoding              | Photon (OpenStreetMap-based) for place autocomplete                               | Debounce input; cache                               |
| Share images           | `next/og` (ImageResponse)                                                         | Profile map preview cards                           |
| Hosting                | Vercel (Hobby)                                                                    | Preview deploys per branch                          |
| Cron (optional)        | Vercel Cron or GitHub Actions                                                     | Refresh stale Wikidata data                         |
| Testing                | Vitest (unit), Playwright (e2e)                                                   |                                                     |
| Lint/format            | ESLint + Prettier                                                                 |                                                     |

**Accounts needed**: GitHub, Vercel, Supabase. Optional: a domain.

**Local tools**: Node.js LTS, pnpm, Supabase CLI, Docker (for local Supabase).

**Environment variables**

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never exposed to the client)
- `NEXT_PUBLIC_MAP_STYLE_URL` (OpenFreeMap style URL)
- `APP_USER_AGENT` (e.g. `LiteraryWorldMap/0.1 (contact email)`, sent to Open Library, Wikidata and Photon)
- `NEXT_PUBLIC_SITE_URL`

**Cost**: zero on free tiers; a domain is the only optional expense.

## Pages and UX

The map is the hero of every main screen: a full-height map with a side panel on desktop and a bottom sheet on mobile.

| Route           | Access    | What it does                                                                                                                                                                                                              |
| --------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | Public    | Landing: headline, sample explore map, sign-up CTA, a few featured places                                                                                                                                                 |
| `/explore`      | Public    | World map of all books by setting, clustered pins. Clicking a cluster zooms; clicking a pin or a country opens a side panel listing books set there (cover, title, author, "Add to shelf"). Search box to jump to a place |
| `/place/[id]`   | Public    | Page for one place: mini map + list of books set there. Shareable, SEO-friendly                                                                                                                                           |
| `/book/[id]`    | Public    | Book page: cover, title, author, year, description, its setting(s) on a mini map, source of each location (Wikidata or readers), "Suggest a location" button                                                              |
| `/me`           | Signed in | Personal map: pins for the user's books, visited countries shaded, stats bar (books, countries, continents), shelf list with filters (read / reading / want to read)                                                      |
| `/add` (modal)  | Signed in | Search Open Library, pick a book, set status, rating and finish date, confirm. Shows detected setting or asks "Where is this book set?"                                                                                   |
| `/u/[username]` | Public    | Read-only version of a user's map and stats; has OG share image                                                                                                                                                           |
| `/settings`     | Signed in | Username, display name, profile public/private, delete account                                                                                                                                                            |
| `/moderate`     | Admin     | Suggestion queue: approve, reject, merge duplicate places                                                                                                                                                                 |

**Key UI components**

- `MapView`: MapLibre map with clustered GeoJSON pin layer, country fill layer, and fly-to on selection.
- `BookSearch`: debounced Open Library search with covers in results.
- `PlacePicker`: Photon autocomplete plus a "fictional place" option and a precision selector (city / region / country).
- `BookCard`, `ShelfList`, `StatsBar`, `SidePanel` (desktop) / `BottomSheet` (mobile).

**Map display rules**

- City or point precision: a pin.
- Region or country precision: shade the area instead of a pin.
- Fictional places: not on the map; listed under "Fictional settings" on the book page and shelf.
- One book with several settings shows several pins, linked when hovered.

## Data model

Postgres with the PostGIS extension enabled. All tables use `uuid` primary keys and `created_at timestamptz default now()`. Write each change as a Supabase migration.

```sql
create extension if not exists postgis;

create type location_precision as enum ('point', 'city', 'region', 'country', 'fictional');
create type location_source as enum ('wikidata', 'user', 'admin');
create type link_status as enum ('approved', 'pending', 'rejected');
create type shelf_status as enum ('read', 'reading', 'want');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  is_public boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

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

create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wikidata_id text unique,
  osm_id text,
  precision location_precision not null,
  geom geography(Point, 4326),       -- null for country-only or fictional
  country_code char(2),              -- ISO 3166-1 alpha-2
  created_at timestamptz default now()
);
create index places_geom_idx on places using gist (geom);

create table book_places (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books on delete cascade,
  place_id uuid not null references places on delete cascade,
  source location_source not null,
  status link_status not null default 'pending',
  created_by uuid references profiles,
  created_at timestamptz default now(),
  unique (book_id, place_id)
);

create table location_votes (
  book_place_id uuid references book_places on delete cascade,
  user_id uuid references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (book_place_id, user_id)
);

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
```

**Row Level Security**

- `books`, `places`: public read; writes only from server code using the service role.
- `book_places`: public read where `status = 'approved'`; users read their own pending rows; inserts through the API only.
- `location_votes`: users insert and delete their own votes.
- `shelf_entries`: owner full access; public read when the owner's profile `is_public`.
- `profiles`: public read of `username`, `display_name`, `is_public`; owner updates own row; `is_admin` changeable only by service role.

**Approval rule**: a pending `book_places` row becomes `approved` when it reaches 3 votes (constant `APPROVAL_THRESHOLD`) or an admin approves it. Implement as a Postgres function called after each vote.

## External data

All external calls happen server-side in `lib/external/*`, send the `APP_USER_AGENT` header, validate responses with Zod, and write results to our database so each book is looked up at most once (re-check after 90 days).

**Open Library** (metadata and covers)

- Search: `GET https://openlibrary.org/search.json?q=<query>&fields=key,title,author_name,first_publish_year,cover_i&limit=10`
- Work details: `GET https://openlibrary.org/works/<OL id>.json` (description)
- Covers: `https://covers.openlibrary.org/b/id/<cover_id>-M.jpg` (use `-S`, `-M`, `-L`); render with `next/image` and a placeholder when missing.

**Wikidata** (settings)

Endpoint: `GET https://query.wikidata.org/sparql?query=<urlencoded>` with `Accept: application/sparql-results+json`.

Step 1, resolve the book's Wikidata ID from its Open Library work ID (Wikidata property P648 = Open Library ID):

```sparql
SELECT ?book WHERE { ?book wdt:P648 "OL45883W" . } LIMIT 1
```

If nothing matches, fall back to a title + author label match and only accept a single unambiguous result.

Step 2, fetch narrative locations (P840) with coordinates (P625), country (P17 to ISO code P297) and type (P31):

```sparql
SELECT ?place ?placeLabel ?coord ?countryCode ?type WHERE {
  wd:Q208460 wdt:P840 ?place .
  OPTIONAL { ?place wdt:P625 ?coord . }
  OPTIONAL { ?place wdt:P17 ?country . ?country wdt:P297 ?countryCode . }
  OPTIONAL { ?place wdt:P297 ?countryCode . }
  OPTIONAL { ?place wdt:P31 ?type . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

Map each result to a `places` row: country items get `precision = 'country'` and no point; items with coordinates get `city` or `point`; items typed as fictional locations get `fictional`. Claude Code should verify the exact Wikidata class IDs for "fictional location", "country" and "city" before hard-coding them, and keep them in one constants file.

**Photon** (place autocomplete for reader suggestions)

- `GET https://photon.komoot.io/api/?q=<query>&limit=5` returns GeoJSON features with name, country code and coordinates.
- Debounce 300 ms, minimum 3 characters, proxy through our API to add caching and the User-Agent.

**Etiquette and limits**

- Cache everything; never call external APIs from the browser directly.
- Serialize Wikidata calls (no parallel bursts) and add retry with exponential backoff on 429 and 5xx.
- Show Open Library and Wikidata attribution in the footer and on book pages; show OpenStreetMap attribution on maps.

## Core flows and API routes

**Add a book**

1. User searches in `BookSearch`; client calls `GET /api/books/search?q=`; server proxies Open Library and returns normalized results.
2. User picks a result and submits status, rating and date; client calls `POST /api/shelf` with `{ olWorkId, status, rating?, finishedOn? }`.
3. Server upserts the `books` row (fetching work details if new), then inserts the `shelf_entries` row.
4. If `setting_checked_at` is null or older than 90 days, server runs the Wikidata lookup, upserts `places`, and inserts `book_places` rows with `source = 'wikidata'`, `status = 'approved'`.
5. Response returns the book with its approved places. If none, the UI shows "Where is this book set?" with `PlacePicker` and a Skip option.
6. Submitting a suggestion calls `POST /api/books/[id]/locations`; server upserts the place, inserts a `pending` link with `source = 'user'`, and records the user's vote.

**Vote on a suggestion**: on the book page, pending suggestions show with a "Confirm this location" button calling `POST /api/locations/[bookPlaceId]/vote`. At the threshold the link becomes approved.

**API routes** (all inputs validated with Zod; auth via Supabase session cookie)

| Method + path                                             | Auth                     | Purpose                                                                                                                            |
| --------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/books/search?q=`                                | Public                   | Proxy Open Library search                                                                                                          |
| `GET /api/books/[id]`                                     | Public                   | Book with approved places and pending suggestions                                                                                  |
| `POST /api/shelf`                                         | User                     | Add or update a shelf entry; triggers setting lookup                                                                               |
| `DELETE /api/shelf/[id]`                                  | Owner                    | Remove a shelf entry                                                                                                               |
| `GET /api/me/map`                                         | User                     | GeoJSON FeatureCollection of the user's pins + list of country codes covered + stats                                               |
| `GET /api/users/[username]/map`                           | Public if profile public | Same as above for a public profile                                                                                                 |
| `GET /api/explore?bbox=minLng,minLat,maxLng,maxLat&zoom=` | Public                   | GeoJSON of approved book places inside the bounding box (PostGIS `ST_Intersects` with `ST_MakeEnvelope`), capped at 2,000 features |
| `GET /api/places/[id]/books`                              | Public                   | Books set at a place, paginated                                                                                                    |
| `GET /api/countries/[code]/books`                         | Public                   | Books set in a country, paginated                                                                                                  |
| `GET /api/places/search?q=`                               | User                     | Proxy Photon for `PlacePicker`                                                                                                     |
| `POST /api/books/[id]/locations`                          | User                     | Suggest a location                                                                                                                 |
| `POST /api/locations/[id]/vote`                           | User                     | Vote for a pending location                                                                                                        |
| `POST /api/admin/locations/[id]`                          | Admin                    | Approve, reject, or merge                                                                                                          |

**Stats** returned with every map: books read, distinct countries, distinct continents (derive continent from country code via a static lookup table), and the top 5 countries by book count.

**Rate limiting**: simple per-user limits on write routes (e.g. 30 suggestions per day) using a Postgres counter table; no extra service needed.

## Seed import pipeline

A one-off script fills the database before launch so Explore is never empty. It lives in `scripts/seed-wikidata.ts` and runs locally with the service role key.

1. Query Wikidata for literary works that have a narrative location, paging with `LIMIT 5000 OFFSET n` until no rows return:

   ```sparql
   SELECT ?book ?bookLabel ?olid ?authorLabel ?place ?placeLabel ?coord ?countryCode WHERE {
     ?book wdt:P31/wdt:P279* wd:Q7725634 ;   # literary work (verify ID)
           wdt:P840 ?place .
     OPTIONAL { ?book wdt:P648 ?olid . }
     OPTIONAL { ?book wdt:P50 ?author . }
     OPTIONAL { ?place wdt:P625 ?coord . }
     OPTIONAL { ?place wdt:P17 ?c . ?c wdt:P297 ?countryCode . }
     SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
   }
   LIMIT 5000 OFFSET 0
   ```

2. If the query times out, split it (e.g. by country or by the instance class) rather than shrinking pages endlessly.
3. Write raw results to `data/seed/*.json` so reruns don't re-query.
4. Normalize: group rows by book, dedupe authors and places, parse `Point(lng lat)` coordinates, classify precision.
5. Upsert into `books`, `places`, `book_places` (`source = 'wikidata'`, `status = 'approved'`) in batches of 500, idempotent on Wikidata IDs.
6. For books with an Open Library ID, optionally backfill `cover_id` in a second slow pass (1 request per second).
7. Log counts: books, places, links, skipped rows and reasons.

The script must be safe to rerun, and should support a `--dry-run` flag and a `--limit` flag for testing.

## Build phases

Build one phase at a time. Each phase ends with a deployable app and passing tests; tick the criteria before starting the next phase.

### Phase 0: Project setup

Scaffold Next.js + TypeScript + Tailwind + shadcn/ui, ESLint, Prettier, Vitest, Playwright, local Supabase, and a CI workflow (lint, typecheck, test).

- [ ] `pnpm dev` runs; `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
- [ ] Local Supabase starts with PostGIS enabled; first migration applies
- [ ] Deployed to Vercel with environment variables set

### Phase 1: Auth and personal shelf

Supabase Auth (magic link + Google), username onboarding, `profiles`, `books`, `shelf_entries`, Open Library search, add/remove books, shelf list.

- [ ] A new user signs up, picks a username, and lands on `/me`
- [ ] Searching "Ulysses" returns results with covers; adding one creates `books` and `shelf_entries` rows
- [ ] RLS blocks reading another user's private shelf (covered by a test)

### Phase 2: Settings and personal map

Wikidata lookup, `places`, `book_places`, `MapView` with pins and shaded countries, stats bar, public profile `/u/[username]`.

- [ ] Adding "Ulysses" shows a pin in Dublin; adding "One Hundred Years of Solitude" shades or pins Colombia
- [ ] A book with no Wikidata setting shows the "Where is this book set?" prompt
- [ ] Stats show correct counts for books, countries and continents
- [ ] Map is usable on a 375 px wide screen (bottom sheet instead of side panel)

### Phase 3: Seed import and Explore

Seed script, `/explore` with bounding-box loading and clustering, `/place/[id]`, `/book/[id]`, country click listing.

- [ ] Seed script dry-run and real run complete; counts logged
- [ ] `/explore` loads pins for the visible area only and stays smooth when panning
- [ ] Clicking a country lists books set there, paginated
- [ ] Place and book pages render server-side with correct page titles

### Phase 4: Crowdsourced locations

`PlacePicker`, suggestions, votes, approval function, `/moderate` admin queue, rate limits.

- [ ] A suggestion appears as pending to others; 3 votes approve it and it appears on Explore
- [ ] Admin can approve, reject and merge duplicate places
- [ ] Users cannot vote twice or vote on their own suggestion

### Phase 5: Polish and launch

OG share images for profiles, landing page, empty states, loading skeletons, error boundaries, attribution footer, `/settings` with account deletion, basic analytics (e.g. Vercel Analytics free tier), SEO sitemap for place and book pages.

- [ ] Sharing `/u/[username]` on social apps shows a map preview image
- [ ] Lighthouse scores 90+ for performance and accessibility on `/` and `/explore`
- [ ] Deleting an account removes the profile and shelf entries

## Conventions, testing and deployment

**Folder structure**

```
app/                  routes (pages + api route handlers)
components/           UI components (map/, books/, ui/)
lib/
  external/           openlibrary.ts, wikidata.ts, photon.ts
  db/                 supabase clients, typed queries
  geo/                precision rules, continent lookup, GeoJSON builders
  validation/         zod schemas
supabase/migrations/  SQL migrations
scripts/              seed-wikidata.ts
tests/                unit (vitest) and e2e (playwright)
public/geo/           countries.geojson (Natural Earth, simplified)
```

**Rules for the codebase**

- TypeScript strict mode; no `any`.
- Server-only code (service role, external APIs) never imported into client components; use the `server-only` package.
- Every API route validates input with Zod and returns typed JSON errors `{ error: { code, message } }`.
- External API clients are wrapped so tests can mock them; unit tests use recorded fixtures, not live calls.
- Database changes only through migrations; regenerate TypeScript types after each.
- Accessible UI: keyboard navigable, visible focus, alt text for covers, a list view alongside every map.
- Commit after each completed task with a clear message.

**Testing priorities**

- Unit: Wikidata result parsing and precision classification, GeoJSON builders, stats, approval function.
- Integration: RLS policies against local Supabase.
- E2E: sign up, add a book, see a pin, suggest a location, view a public profile.

**Deployment**: Vercel connected to GitHub (main = production, branches = previews). Run migrations against the hosted Supabase project with the Supabase CLI. Run the seed script once against production after Phase 3.

## Starter prompt for Claude Code

Paste this into Claude Code from the repo root after saving this doc as `SPEC.md`:

```
Read SPEC.md fully. It is the source of truth for this project.
Create a CLAUDE.md summarizing the stack, folder structure and codebase rules from the spec.
Then implement Phase 0 only. Before writing code, list the tasks you plan to do and any
questions or ambiguities you see in the spec. When Phase 0 is done, run lint, typecheck and
tests, show me the results, check off the Phase 0 acceptance criteria, and stop.
```

For each later phase: "Implement Phase N from SPEC.md. Plan first, then build, then verify the acceptance criteria and stop."
