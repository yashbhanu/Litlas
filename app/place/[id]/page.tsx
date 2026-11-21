import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookList } from "@/components/books/book-list";
import { PaginationLinks } from "@/components/books/pagination";
import { MapView } from "@/components/map/map-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooksAtPlace, getPlace } from "@/lib/db/public";
import { countryName } from "@/lib/geo/continents";
import type { PinCollection } from "@/lib/geo/map";
import { isPinPrecision } from "@/lib/geo/precision";
import { pageSchema, uuidSchema } from "@/lib/validation/explore";

async function loadPlace(params: PageProps<"/place/[id]">["params"]) {
  const id = uuidSchema.safeParse((await params).id);
  return id.success ? getPlace(id.data) : null;
}

export async function generateMetadata({ params }: PageProps<"/place/[id]">): Promise<Metadata> {
  const place = await loadPlace(params);
  if (!place) return { title: "Place not found" };
  const where =
    place.countryCode && place.precision !== "country" ? `, ${countryName(place.countryCode)}` : "";
  return {
    title: `Books set in ${place.name}`,
    description: `Novels and other books set in ${place.name}${where}.`,
  };
}

/** One place: mini map and the books set there, paginated (?page=N). */
export default function PlacePage({ params, searchParams }: PageProps<"/place/[id]">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PlaceContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function PlaceContent({
  params,
  searchParams,
}: Pick<PageProps<"/place/[id]">, "params" | "searchParams">) {
  const place = await loadPlace(params);
  if (!place) notFound();
  const pageParam = (await searchParams).page;
  const page = pageSchema.catch(1).parse(Array.isArray(pageParam) ? pageParam[0] : pageParam);
  const list = await getBooksAtPlace(place.id, page);

  const pins: PinCollection = {
    type: "FeatureCollection",
    features:
      isPinPrecision(place.precision) && place.lng !== null && place.lat !== null
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [place.lng, place.lat] },
              properties: {
                bookId: place.id,
                placeId: place.id,
                title: place.name,
                placeName: place.countryCode ? countryName(place.countryCode) : "",
              },
            },
          ]
        : [],
  };
  const countries = place.countryCode && place.precision !== "fictional" ? [place.countryCode] : [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {place.precision === "fictional"
            ? "Fictional place"
            : place.countryCode && place.precision !== "country"
              ? countryName(place.countryCode)
              : "Country"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Books set in {place.name}</h1>
        <p className="text-sm text-muted-foreground">
          {list.total} {list.total === 1 ? "book" : "books"} ·{" "}
          <Link href="/explore" className="underline-offset-4 hover:underline">
            Explore the map
          </Link>
        </p>
      </header>

      {countries.length > 0 ? (
        <div className="h-64 overflow-hidden rounded-lg border">
          <MapView pins={pins} countries={countries} label={`Map of ${place.name}`} />
        </div>
      ) : null}

      {list.books.length ? (
        <BookList books={list.books} label={`Books set in ${place.name}`} />
      ) : (
        <p className="text-sm text-muted-foreground">No books here yet.</p>
      )}
      <PaginationLinks
        page={list.page}
        pageCount={list.pageCount}
        href={(n) => `/place/${place.id}${n > 1 ? `?page=${n}` : ""}`}
      />
    </div>
  );
}
