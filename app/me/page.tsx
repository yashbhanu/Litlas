import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddBookDialog } from "@/components/books/add-book-dialog";
import { ShelfList } from "@/components/books/shelf-list";
import { MapLayout } from "@/components/map/map-layout";
import { MapPageSkeleton } from "@/components/map/map-page-skeleton";
import { MapView } from "@/components/map/map-view";
import { PlaceList } from "@/components/map/place-list";
import { StatsBar } from "@/components/map/stats-bar";
import { getProfile, getSessionUser } from "@/lib/auth";
import { loadShelfMap } from "@/lib/db/map";
import { createSupabaseServerClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "My map" };

export default function MePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<MapPageSkeleton label="Loading your map" />}>
        <MeContent />
      </Suspense>
    </main>
  );
}

async function MeContent() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/onboarding?next=/me");

  const { entries, map } = await loadShelfMap(await createSupabaseServerClient(), user.id);

  return (
    <MapLayout
      panelLabel="Your shelf and stats"
      map={
        <MapView pins={map.pins} countries={map.countries} label="Map of the books you've read" />
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My reading map</h1>
          <p className="text-sm text-muted-foreground">
            {profile.displayName ? `${profile.displayName} · ` : ""}
            <Link href={`/u/${profile.username}`} className="underline-offset-4 hover:underline">
              @{profile.username}
            </Link>
            {profile.isPublic ? "" : " · private"}
          </p>
        </div>
        <AddBookDialog />
      </div>

      <StatsBar stats={map.stats} />
      <PlaceList map={map} emptyText="Books you mark as read appear on the map." />

      <section aria-labelledby="shelf-title" className="space-y-3">
        <h2 id="shelf-title" className="text-base font-semibold">
          My shelf
        </h2>
        <ShelfList entries={entries} />
      </section>
    </MapLayout>
  );
}
