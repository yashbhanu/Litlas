import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddBookDialog } from "@/components/books/add-book-dialog";
import { ShelfList } from "@/components/books/shelf-list";
import { MapView } from "@/components/map/map-view";
import { PlaceList } from "@/components/map/place-list";
import { ReadingMapSkeleton } from "@/components/reading-map/reading-map-skeleton";
import { Panel, ReadingMapLayout } from "@/components/reading-map/reading-map-layout";
import { RecentlyRead } from "@/components/reading-map/recently-read";
import { SettingPromptCard } from "@/components/reading-map/setting-prompt-card";
import { ShareButton } from "@/components/reading-map/share-button";
import { StatCards } from "@/components/reading-map/stat-cards";
import { getProfile, getSessionUser } from "@/lib/auth";
import { loadShelfMap } from "@/lib/db/map";
import { createSupabaseServerClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "My map" };

export default function MePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<ReadingMapSkeleton label="Loading your map" />}>
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
    <ReadingMapLayout
      panelLabel="Your shelf and stats"
      head={
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Your reading map</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                @{profile.username}
                {profile.isPublic ? "" : " · private"}
              </p>
            </div>
            <ShareButton username={profile.username} isPublic={profile.isPublic} />
          </div>
          <StatCards stats={map.stats} />
        </div>
      }
      map={
        <MapView
          pins={map.pins}
          countries={map.countries}
          label="Map of the books you've read"
          showLegend
        />
      }
    >
      {map.unplaced.length > 0 ? <SettingPromptCard books={map.unplaced} /> : null}

      {entries.length === 0 ? (
        <Panel className="space-y-3 text-center">
          <h2 className="text-lg font-semibold">Start your map</h2>
          <p className="text-sm text-muted-foreground">
            Add a book you&apos;ve read and see it pinned where its story is set.
          </p>
          <div className="flex justify-center">
            <AddBookDialog />
          </div>
        </Panel>
      ) : (
        <RecentlyRead entries={entries} />
      )}

      <Panel>
        <PlaceList map={map} emptyText="Books you mark as read appear on the map." />
      </Panel>

      <section id="shelf" aria-labelledby="shelf-title" className="scroll-mt-24 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="shelf-title" className="text-lg font-semibold">
            My shelf
          </h2>
          <AddBookDialog triggerClassName="h-8 rounded-lg" />
        </div>
        <ShelfList entries={entries} />
      </section>
    </ReadingMapLayout>
  );
}
