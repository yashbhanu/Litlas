import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookList } from "@/components/books/book-list";
import { PaginationLinks } from "@/components/books/pagination";
import { MapView } from "@/components/map/map-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooksInCountry } from "@/lib/db/public";
import { continentOf, countryName, knownCountryCodes } from "@/lib/geo/continents";
import { countryCodeSchema, pageSchema } from "@/lib/validation/explore";

const EMPTY_PINS = { type: "FeatureCollection" as const, features: [] };

function parseCode(code: string): string | null {
  const parsed = countryCodeSchema.safeParse(code);
  return parsed.success && knownCountryCodes().includes(parsed.data) ? parsed.data : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/country/[code]">): Promise<Metadata> {
  const code = parseCode((await params).code);
  if (!code) return { title: "Country not found" };
  return {
    title: `Books set in ${countryName(code)}`,
    description: `Novels and other books set in ${countryName(code)}, from Wikidata and readers.`,
  };
}

/** All books set in a country, paginated (?page=N). */
export default function CountryPage({ params, searchParams }: PageProps<"/country/[code]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-6">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <CountryContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CountryContent({
  params,
  searchParams,
}: Pick<PageProps<"/country/[code]">, "params" | "searchParams">) {
  const code = parseCode((await params).code);
  if (!code) notFound();
  const pageParam = (await searchParams).page;
  const page = pageSchema.catch(1).parse(Array.isArray(pageParam) ? pageParam[0] : pageParam);
  const list = await getBooksInCountry(code, page);
  const name = countryName(code);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {continentOf(code) ?? "Country"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">Books set in {name}</h1>
          <p className="text-sm text-muted-foreground">
            {list.total} {list.total === 1 ? "book" : "books"} · {list.placeCount}{" "}
            {list.placeCount === 1 ? "place" : "places"} ·{" "}
            <Link
              href={`/explore?country=${code}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              View on the map
            </Link>
          </p>
        </header>
        {list.books.length ? (
          <BookList books={list.books} label={`Books set in ${name}`} className="-mx-2" />
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No books set here yet.
          </p>
        )}
        <PaginationLinks
          page={list.page}
          pageCount={list.pageCount}
          href={(n) => `/country/${code}${n > 1 ? `?page=${n}` : ""}`}
        />
      </div>
      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--app-header)+2rem)] lg:self-start">
        <div className="h-56 overflow-hidden rounded-2xl border">
          <MapView pins={EMPTY_PINS} countries={[code]} label={`Map of ${name}`} />
        </div>
        {list.topPlaces.length ? (
          <div className="rounded-2xl border p-4">
            <h2 className="text-sm font-semibold">Top places</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {list.topPlaces.map((place) => (
                <li key={place.placeId} className="flex justify-between gap-2">
                  <Link
                    href={`/place/${place.placeId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {place.name}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">{place.bookCount}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
