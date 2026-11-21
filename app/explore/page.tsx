import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreView } from "@/components/explore/explore-view";
import { MapPageSkeleton } from "@/components/map/map-page-skeleton";

export const metadata: Metadata = {
  title: "Explore books by place",
  description: "A world map of novels and other books, pinned where their stories are set.",
};

export default function ExplorePage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* useSearchParams (deep links) needs a Suspense boundary. */}
      <Suspense fallback={<MapPageSkeleton label="Loading the map" />}>
        <ExploreView />
      </Suspense>
    </main>
  );
}
