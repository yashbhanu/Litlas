import { ArrowRightIcon, GlobeIcon, MapPinIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { WorldMapSvg } from "@/components/og/world-map-svg";
import { Skeleton } from "@/components/ui/skeleton";
import { getLandingData } from "@/lib/db/public";
import { countryName } from "@/lib/geo/continents";

const number = new Intl.NumberFormat("en");

/** Sample explore map: the most-read places worldwide, linking to /explore. */
export async function SampleMap() {
  const data = await getLandingData();
  return (
    <Link
      href="/explore"
      className="group relative block overflow-hidden rounded-3xl border bg-background shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <WorldMapSvg
        pins={data.pins}
        countries={data.countries}
        title={`Sample map: ${number.format(data.totals.places)} places with books`}
      />
      <span className="absolute bottom-3 left-3 rounded-xl border bg-background/95 px-3 py-1.5 text-sm font-medium shadow-sm">
        {number.format(data.totals.books)} books on the map
        <ArrowRightIcon
          aria-hidden
          className="ml-1 inline size-4 transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

export function SampleMapSkeleton() {
  return <Skeleton className="aspect-[1000/394] w-full rounded-3xl" />;
}

export async function Totals() {
  const { totals } = await getLandingData();
  const items = [
    { value: totals.books, label: "books" },
    { value: totals.places, label: "places" },
    { value: totals.countries, label: "countries" },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x rounded-2xl border bg-background">
      {items.map(({ value, label }) => (
        <div key={label} className="flex flex-col-reverse px-4 py-5 text-center">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
            {number.format(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export async function FeaturedPlaces() {
  const { featured } = await getLandingData();
  if (featured.length === 0) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Featured places">
      {featured.map((place) => (
        <li key={place.placeId}>
          <Link
            href={`/place/${place.placeId}`}
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors outline-none hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e07a1f]/10 text-[#b45309]">
              <MapPinIcon aria-hidden className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{place.name}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {place.countryCode ? countryName(place.countryCode) : "Somewhere"} ·{" "}
                {number.format(place.bookCount)} {place.bookCount === 1 ? "book" : "books"}
              </span>
            </span>
            <ArrowRightIcon aria-hidden className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const FEATURES = [
  {
    icon: MapPinIcon,
    title: "Pin every book you read",
    body: "Log a book and it lands where its story is set, from Dublin to Macondo.",
  },
  {
    icon: GlobeIcon,
    title: "Explore by place",
    body: "Click a city or a country to find the novels set there.",
  },
  {
    icon: UsersIcon,
    title: "Built with readers",
    body: "Settings come from Wikidata and readers like you, confirmed by the community.",
  },
] as const;

export function Features() {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {FEATURES.map(({ icon: Icon, title, body }) => (
        <li key={title} className="rounded-2xl border p-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Icon aria-hidden className="size-5" />
          </span>
          <h3 className="mt-4 text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </li>
      ))}
    </ul>
  );
}
