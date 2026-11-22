import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Hero } from "@/components/landing/hero";
import {
  FeaturedPlaces,
  Features,
  SampleMap,
  SampleMapSkeleton,
  Totals,
} from "@/components/landing/landing-sections";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Landing: headline, sample explore map, featured places, sign-up CTA. */
export default function Home() {
  return (
    <main className="flex-1">
      <Hero
        map={
          <Suspense fallback={<SampleMapSkeleton />}>
            <SampleMap />
          </Suspense>
        }
      />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 lg:px-6">
        <Suspense fallback={<Skeleton className="h-24 rounded-2xl" />}>
          <Totals />
        </Suspense>

        <section aria-labelledby="featured-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-2">
            <h2 id="featured-heading" className="text-2xl font-semibold tracking-tight">
              Where readers travel most
            </h2>
            <Link
              href="/explore"
              className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              Explore all
            </Link>
          </div>
          <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
            <FeaturedPlaces />
          </Suspense>
        </section>

        <section aria-labelledby="how-heading" className="space-y-4">
          <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <Features />
        </section>

        <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-primary px-6 py-8 text-primary-foreground sm:flex-row sm:items-center lg:px-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Where will your next book take you?
            </h2>
            <p className="mt-1 opacity-90">
              Free, no ads. Sign in with your email and start pinning.
            </p>
          </div>
          <Link
            href="/login?next=/me"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 shrink-0 rounded-xl border-transparent bg-background px-5 text-base text-foreground",
            )}
          >
            Start your map
            <ArrowRightIcon aria-hidden />
          </Link>
        </section>
      </div>
    </main>
  );
}
