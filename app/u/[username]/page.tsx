import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReadOnlyShelf } from "@/components/books/read-only-shelf";
import { MapLayout } from "@/components/map/map-layout";
import { MapPageSkeleton } from "@/components/map/map-page-skeleton";
import { MapView } from "@/components/map/map-view";
import { PlaceList } from "@/components/map/place-list";
import { StatsBar } from "@/components/map/stats-bar";
import { getSessionUser } from "@/lib/auth";
import { findProfileByUsername, loadShelfMap } from "@/lib/db/map";
import { createSupabaseServerClient } from "@/lib/db/server";
import { usernameParamSchema } from "@/lib/validation/profile";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const parsed = usernameParamSchema.safeParse(username);
  return { title: parsed.success ? `@${parsed.data}'s reading map` : "Reader not found" };
}

/** Public, read-only version of a reader's map and stats. */
export default function UserPage({ params }: PageProps<"/u/[username]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<MapPageSkeleton label="Loading reading map" />}>
        <UserContent params={params} />
      </Suspense>
    </main>
  );
}

async function UserContent({ params }: { params: PageProps<"/u/[username]">["params"] }) {
  const parsed = usernameParamSchema.safeParse((await params).username);
  if (!parsed.success) notFound();

  const supabase = await createSupabaseServerClient();
  const profile = await findProfileByUsername(supabase, parsed.data);
  if (!profile) notFound();

  const isOwner = (await getSessionUser())?.id === profile.id;
  const name = profile.displayName ?? `@${profile.username}`;

  if (!profile.isPublic && !isOwner) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-2 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight">@{profile.username}</h1>
        <p className="text-muted-foreground">This reader keeps their map private.</p>
      </div>
    );
  }

  const { entries, map } = await loadShelfMap(supabase, profile.id);

  return (
    <MapLayout
      panelLabel={`${name}'s shelf and stats`}
      map={
        <MapView
          pins={map.pins}
          countries={map.countries}
          label={`Map of books ${name} has read`}
        />
      }
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{name}&apos;s reading map</h1>
        {profile.displayName ? (
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
        ) : null}
        {isOwner && !profile.isPublic ? (
          <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
            Your profile is private. Only you can see this page.
          </p>
        ) : null}
      </div>

      <StatsBar stats={map.stats} />
      <PlaceList map={map} emptyText="No books read yet." />

      <section aria-labelledby="public-shelf-title" className="space-y-3">
        <h2 id="public-shelf-title" className="text-base font-semibold">
          Shelf
        </h2>
        <ReadOnlyShelf entries={entries} />
      </section>
    </MapLayout>
  );
}
