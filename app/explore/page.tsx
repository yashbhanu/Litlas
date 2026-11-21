import type { Metadata } from "next";
import { ExploreView } from "@/components/explore/explore-view";

export const metadata: Metadata = {
  title: "Explore books by place",
  description: "A world map of novels and other books, pinned where their stories are set.",
};

export default function ExplorePage() {
  return (
    <main className="flex flex-1 flex-col">
      <ExploreView />
    </main>
  );
}
