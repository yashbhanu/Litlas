import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Landing hero: headline, pitch, sign-up CTA; `map` is the sample explore map. */
export function Hero({ map }: { map?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.9_0.05_180/0.55),transparent_60%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[1fr_1.15fr] lg:px-6 lg:py-24">
        <div className="space-y-6">
          <p className="text-sm font-medium text-primary">Literary World Map</p>
          <h1 className="text-5xl font-semibold tracking-tight text-balance lg:text-6xl">
            Read around the world.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Log the books you read and see each one pinned where its story is set. Count your
            countries and continents, and find your next book by where it takes you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/me"
              className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-xl px-5 text-base")}
            >
              Start your map, free
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
        {map}
      </div>
    </section>
  );
}
