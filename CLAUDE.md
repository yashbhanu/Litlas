# Literary World Map — guide for Claude Code

`SPEC.md` is the source of truth. Read the relevant section before changing anything. This file summarizes it.

A free web app where readers log books, and each book shows up as a pin where its story is set. Users get a personal "read around the world" map, a public explore map and crowdsourced settings. Free tiers only. No AI features, payments or native app in v1.

@AGENTS.md

## Working agreement

- Work **one build phase at a time** (see SPEC.md → Build phases). Plan first, build, verify that phase's acceptance criteria, then stop.
- **Do not create git commits** unless the user explicitly asks for one. (This overrides the spec's "commit after each task".)
- This is **Next.js 16** and differs from older versions. Check `node_modules/next/dist/docs/` before using Next APIs. `cacheComponents` is enabled in `next.config.ts`.

## Stack

| Layer          | Choice                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| Framework      | Next.js App Router + TypeScript strict; server components for pages, route handlers for API |
| Styling        | Tailwind CSS v4 + shadcn/ui (base-ui primitives, `cn` package), light/dark via next-themes  |
| Map            | MapLibre GL JS via `react-map-gl/maplibre` (clustering); OpenFreeMap tiles                  |
| Country shapes | Natural Earth admin-0, simplified → `public/geo/countries.geojson`                          |
| DB / Auth      | Supabase Postgres + PostGIS, RLS; Supabase Auth (magic link + Google)                       |
| Data access    | Supabase JS + generated types (`lib/db/database.types.ts`)                                  |
| Validation     | Zod (v4) for all API inputs, external responses and env                                     |
| Client data    | TanStack Query                                                                              |
| External APIs  | Open Library (search/works/covers), Wikidata SPARQL, Photon geocoding                       |
| Share images   | `next/og` ImageResponse                                                                     |
| Hosting        | Vercel Hobby; optional Vercel Cron / GitHub Actions                                         |
| Testing        | Vitest (unit, jsdom), Playwright (e2e)                                                      |
| Lint/format    | ESLint (flat config, next + prettier) + Prettier (tailwind plugin)                          |

Package manager is **pnpm**. The Supabase CLI is a dev dependency, so run it with `pnpm exec supabase …`. Local Supabase needs Docker.

## Commands

```bash
pnpm dev            # Next dev server (http://localhost:3000)
pnpm lint           # ESLint
pnpm format         # Prettier write (format:check in CI)
pnpm typecheck      # next typegen + tsc --noEmit
pnpm test           # Vitest unit tests (tests/unit), no network or DB
pnpm test:integration  # Vitest against local Supabase (tests/integration): RLS policies
pnpm test:e2e       # Playwright (tests/e2e), starts dev server itself; needs local Supabase
pnpm db:start       # Start local Supabase (applies migrations)
pnpm db:stop        # Stop it. Restart after editing supabase/config.toml (auth config is read at start)
pnpm db:reset       # Re-apply all migrations + supabase/seed.sql
pnpm db:types       # Regenerate lib/db/database.types.ts from local DB
pnpm countries:build   # Rebuild public/geo/countries.geojson + lib/geo/country-bounds.json (Natural Earth)
pnpm seed --dry-run [--limit N]   # Wikidata seed import: fetch + normalize + log counts, no writes
pnpm seed [--covers] [--refresh]  # Write to the DB in .env.local; --env <file> --yes for a non-local DB
pnpm admin:grant <username> [--revoke]  # Make a user a moderator (service role); --env/--yes as above
```

The seed (`scripts/seed-wikidata.ts`, pure logic in `lib/seed/wikidata-seed.ts`) splits the spec's single query, which times out on WDQS:

1. List classes under literary work, excluding film, TV and video-game classes.
2. Page book IDs per class with LIMIT/OFFSET.
3. Fetch details in VALUES batches of 300, using `rdfs:label` rather than the label service, which is about 7× faster.
4. Fetch place-classification flags in batches.

Raw responses are cached in `data/seed/` (gitignored), so reruns are fast and offline. A batch that times out is split in half. Continents are never placed: Wikidata gives each one a single coordinate.

`postinstall` copies MapLibre's web worker to `public/maplibre/maplibre-gl-worker-<version>.mjs` (gitignored). maplibre-gl 6 loads its worker from a file next to its module, which bundlers don't emit; `components/map/map-canvas.tsx` points `setWorkerUrl()` at the copy. If the map logs "Worker failed to load", run `pnpm install`.

CI (`.github/workflows/ci.yml`):

- Job 1 runs lint, format check, typecheck and unit tests.
- Job 2 starts local Supabase, checks the generated types are current, then runs the integration and e2e tests.

Local auth emails (magic links) are captured by Mailpit at http://127.0.0.1:54324. The e2e tests read them through its API.

## Environment

See `.env.example`. Copy it to `.env.local`.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_SITE_URL`: public. Read them with `getPublicEnv()` from `lib/env.ts`.
- `SUPABASE_SERVICE_ROLE_KEY`, `APP_USER_AGENT`: server only. Read them with `getServerEnv()` from `lib/env.server.ts` (`server-only`).
- Schemas live in `lib/validation/env.ts`.
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` shows the Google button on `/login`. Only set it once the Google provider is configured in Supabase. For local setup, see the comment above `[auth.external.google]` in `supabase/config.toml`.

## Folder structure

```
app/                  routes (pages + api route handlers)
components/           UI components (map/, books/, ui/ ← shadcn)
proxy.ts              session refresh + signed-out redirects (Next 16's name for middleware)
lib/
  external/           http.ts (fetchJson: UA, retry, Zod), openlibrary.ts (pure, testable client),
                      photon.ts / photon.server.ts (place autocomplete, `use cache`),
                      openlibrary.server.ts (default instance + `use cache` search),
                      wikidata.ts (SPARQL client: serialized queue, parsing, classification),
                      wikidata.server.ts (process-wide instance), wikidata-constants.ts (verified P/Q ids)
  db/                 server.ts (user client, RLS), admin.ts (service role), browser.ts, proxy.ts,
                      books.ts / shelf.ts / places.ts / map.ts (typed queries),
                      public.ts (cookie-less anon client + `use cache` reads for explore/book/place pages),
                      settings.ts (Wikidata setting lookup + cache writes), database.types.ts (generated)
  seed/               wikidata-seed.ts (seed queries + normalization, pure)
  locations/          constants (threshold, rate limits), types, route error mapping
  geo/                precision.ts (rules + classifyPlace), continents.ts (ISO → continent, names),
                      bbox.ts (antimeridian split, padded/snapped request boxes),
                      map.ts (pins GeoJSON, stats, list view, mapBounds), country-bounds.json (generated)
  validation/         zod schemas (env, books, shelf, profile, auth)
  books/              client-safe helpers/types (cover URLs, ShelfEntry)
  auth.ts             getSessionUser() / getProfile() (server-only, per-request cached)
  api.ts              apiError(), parseJsonBody() for route handlers
  api-client.ts       apiFetch() + ApiRequestError for client components
hooks/                client hooks
supabase/migrations/  SQL migrations (only way to change the DB)
scripts/              seed-wikidata.ts
tests/unit/           Vitest (*.test.ts[x]); fixtures-backed, server-only is stubbed
tests/integration/    Vitest against local Supabase (RLS)
tests/e2e/            Playwright (*.spec.ts)
tests/fixtures/       recorded external API responses
public/geo/           countries.geojson (Natural Earth 1:110m + 1:50m small countries, ~200 KB)
public/maplibre/      MapLibre worker copy (generated on install, gitignored)
data/seed/            raw Wikidata dumps from the seed script (Phase 3)
```

## Codebase rules

- TypeScript strict. **No `any`** (ESLint enforces this as an error).
- Server-only code (service role key, external API clients) imports `server-only` and is never imported into client components.
- Every API route validates input with Zod and returns typed JSON errors shaped `{ error: { code, message } }`.
- External calls happen **server-side only** in `lib/external/*`. They send the `APP_USER_AGENT` header, validate responses with Zod, and cache results in the DB (re-check a book's setting after 90 days). Never call external APIs from the browser.
- Serialize Wikidata calls and retry with exponential backoff on 429/5xx. Debounce Photon by 300 ms with a 3-character minimum, proxied through our API.
- External clients are wrapped so tests can mock them. Unit tests use recorded fixtures, never live calls.
- DB changes go **only through migrations** in `supabase/migrations/`. Run `pnpm db:types` after each one.
- **Grant table privileges explicitly** in the migration that creates a table (`anon`, `authenticated`, `service_role`, and execute on functions revoked from public). Hosted Supabase no longer grants them by default, although the local CLI still does, so a missing grant only fails in production (see `20261125000000_explicit_grants.sql`).
- PostGIS lives in the `extensions` schema (Supabase convention).
- `profiles` uses column-level grants: clients may select only `id, username, display_name, is_public, created_at` and can never read or write `is_admin`. **Always select explicit columns from `profiles`, because `select('*')` is denied.** Admin checks use the service-role client.
- Use the user client (`createSupabaseServerClient`) for user data so RLS applies. The service-role client (`createSupabaseAdminClient`) is only for server-owned writes (books, places, admin actions).
- With Cache Components, anything that reads the session must sit inside `<Suspense>`. `createSupabaseServerClient()` calls `await connection()`, because supabase-js reads the clock and must not run during prerendering.
- Private profiles: username and display name stay publicly visible, but the shelf/map is hidden by RLS.
- Accessibility: keyboard navigable, visible focus, alt text on covers, and a list view alongside every map.
- Attribution: Open Library and Wikidata in the footer and on book pages, OpenStreetMap on maps.
- UI follows the mockups (`Literary World Map — UI mockups.pdf`).
  - Visual tokens:
    - Colours are tokens in `app/globals.css`: primary teal, `pin` orange, `cluster` navy, `warm` (prompt card) and `surface`.
    - Map colours mirror them in `components/map/maplibre-setup.ts` (`MAP_COLORS`, `tuneBasemap`), on top of the OpenFreeMap **positron** style.
    - Fonts are Inter (body) and Space Grotesk (`font-heading`, applied to h1–h3).
  - Layout:
    - A sticky header with nav, global search (`/api/search`) and "Add a book".
    - A bottom tab bar on phones. The CSS variables `--app-header` and `--app-tabbar` size full-height pages.
    - `/explore` uses `MapLayout`: a side panel, or a bottom sheet on phones.
    - `/me` and `/u/[username]` use `ReadingMapLayout`: stacked cards on phones, map plus panel on desktop.
  - Client components that call `usePathname` / `useSearchParams` must render inside `<Suspense>`, with a fallback that doesn't call the hook (`NavLinks`, `TabLinks`).
- Launch pieces (Phase 5):
  - **Share images:** `app/u/[username]/opengraph-image.tsx` draws the reader's map with `components/og/world-map-svg.tsx`.
    - The SVG paths are pre-projected into `lib/geo/world-paths.json` by `pnpm countries:build`, using the projection in `lib/geo/svg-map.ts`.
    - The data is cached per reader (tag `reader:<username>`), revalidated on shelf and profile changes.
  - **Sitemap:** `app/sitemap.ts` (books, places, countries; regenerated daily), plus `app/robots.ts`.
  - **Pages:** `/settings` (profile, privacy, account deletion via `DELETE /api/me`), `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
  - **Landing page:** `components/landing/*`, built from cached `getLandingData()`.
  - **Analytics:** `<Analytics />` from `@vercel/analytics`.
- Use `components/books/book-cover.tsx` for covers (`next/image`, `unoptimized` to stay inside the Vercel Hobby image quota, with a placeholder when missing).
- Client components talk to our API with TanStack Query + `apiFetch`. After a mutation that changes server-rendered data, call `router.refresh()`.

## Domain rules (quick reference)

- Precision enum: `point | city | region | country | fictional`.
  - point/city → pin
  - region/country → shaded area. We only ship country shapes, so a region shades its whole country.
  - fictional → not on the map, listed under "Fictional settings"
- A book with several settings gets several pins, linked on hover.
- Crowdsourced locations: a pending `book_places` row is approved at `APPROVAL_THRESHOLD = 3` votes, or by an admin.
  - Approval is the Postgres function `apply_location_approval`, run by a trigger after each vote insert. SQL `approval_threshold()` mirrors `lib/locations/constants.ts`, and a test checks they match.
  - The suggester's own vote counts: the server records it with the service role when they suggest. So 2 other readers are needed.
  - RLS on `location_votes` stops voting on your own suggestion, voting twice (primary key), voting as someone else, and voting on non-pending links.
  - Pending suggestions are publicly readable so others can confirm them. This deliberately deviates from the spec's "own pending only". Rejected ones are visible only to their suggester.
  - Maps and Explore only ever use approved links.
  - Suggestions reuse existing places: a country by ISO code (preferring the Wikidata row), a real place by OSM ID and precision, a fictional place by name.
  - Moderation (`/moderate`, `POST /api/admin/locations/[id]`) uses the service role. Merge is the SQL `merge_places`, which moves links and votes, then deletes the duplicate.
  - After approval, rejection or merge, call `revalidateBookPlaces(bookId)` (`lib/db/revalidate.ts`).
- Stats on every map: books read, distinct countries, distinct continents (static country→continent lookup), top 5 countries.
- Personal/public maps and stats cover shelf entries with status `read`. The shelf list shows every status, each with its setting summary.
- Setting lookup runs inside `POST /api/shelf` (`ensureBookSettings`). A Wikidata failure doesn't block adding the book; `setting_checked_at` stays null so it retries. Places come back through the `book_place_coords(uuid[])` SQL function (security invoker, approved links only, plain lng/lat).
- A book with no approved places triggers "Where is this book set?" after adding. Phase 4 adds the PlacePicker there.
- Explore (`components/explore/`) loads pins with `GET /api/explore?bbox=&zoom=` (SQL `explore_places`, capped at 2,000, most-read first).
  - The client requests a padded, grid-snapped box and only refetches when the view leaves it, or when a capped result is zoomed into.
  - The map view lives in the URL hash (`#zoom/lat/lng`).
- Public reads (`lib/db/public.ts`) are cached with tags `book-places` and `book:<id>`. Call `revalidateTag(tag, "max")` after changing book↔place links. `POST /api/shelf` does this after a setting lookup.
- `POST /api/shelf` accepts `{ olWorkId }` (search results) or `{ bookId }` (known books, since seeded books may lack an Open Library ID).
- `/book/[id]` and `/place/[id]`: `proxy.ts` 404s malformed IDs. With Cache Components, unknown valid IDs render not-found with `noindex`, but the status stays 200 because streaming has already started.
- Rate limits for write routes use the Postgres counter table `rate_limits` via `consume_rate_limit()` (`lib/db/rate-limit.ts`).
  - Limits are in `RATE_LIMITS`: 30 suggestions, 100 votes and 300 shelf writes per day.
  - Over the limit, the API returns 429 `rate_limited`.
- The Supabase API caps responses at 1,000 rows (`max_rows`). Page larger reads with `fetchAllPages` (`lib/db/paging.ts`).
- Wikidata class IDs (fictional location, country, city, literary work) must be verified before hard-coding. Keep them in one constants file.

## Testing priorities

- Unit: Wikidata parsing and precision classification, GeoJSON builders, stats, approval function.
- Integration: RLS policies against local Supabase.
- E2E: sign up, add a book, see a pin, suggest a location, view a public profile.
