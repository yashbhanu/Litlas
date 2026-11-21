import { ArrowRightIcon, GlobeIcon, MapPinIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: MapPinIcon,
    title: "Pin every book you read",
    body: "Log a book and it lands where its story is set, from Dublin to Macondo.",
  },
  {
    icon: GlobeIcon,
    title: "Explore by place",
    body: "Click a city or a country to find thousands of novels set there.",
  },
  {
    icon: UsersIcon,
    title: "Built with readers",
    body: "Settings come from Wikidata and readers like you, confirmed by the community.",
  },
] as const;

export default function Home() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.9_0.05_180/0.6),transparent_60%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-20 lg:px-6 lg:py-28">
          <p className="text-sm font-medium text-primary">Literary World Map</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance lg:text-6xl">
            Read around the world.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Log the books you read and see each one pinned at the place its story is set. Count your
            countries and continents, and find your next book by where it takes you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/me"
              className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-xl px-5 text-base")}
            >
              Start your map
              <ArrowRightIcon aria-hidden />
            </Link>
            <Link
              href="/explore"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-xl bg-background px-5 text-base",
              )}
            >
              Explore the map
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-3 lg:px-6">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <Icon aria-hidden className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
