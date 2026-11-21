import type { Metadata } from "next";
import { LockIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReadOnlyShelf } from "@/components/books/read-only-shelf";
import { MapView } from "@/components/map/map-view";
import { PlaceList } from "@/components/map/place-list";
import { ReadingMapSkeleton } from "@/components/reading-map/reading-map-skeleton";
import { Panel, ReadingMapLayout } from "@/components/reading-map/reading-map-layout";
import { RecentlyRead } from "@/components/reading-map/recently-read";
import { ShareButton } from "@/components/reading-map/share-button";
import { StatCards } from "@/components/reading-map/stat-cards";
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
      <Suspense fallback={<ReadingMapSkeleton label="Loading reading map" />}>
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <LockIcon aria-hidden className="size-5 text-muted-foreground" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">@{profile.username}</h1>
        <p className="text-muted-foreground">This reader keeps their map private.</p>
      </div>
    );
  }

  const { entries, map } = await loadShelfMap(supabase, profile.id);

  return (
    <ReadingMapLayout
      panelLabel={`${name}'s shelf and stats`}
      head={
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">{name}&apos;s reading map</h1>
              {profile.displayName ? (
                <p className="mt-0.5 text-sm text-muted-foreground">@{profile.username}</p>
              ) : null}
            </div>
            <ShareButton username={profile.username} isPublic={profile.isPublic} />
          </div>
          {isOwner && !profile.isPublic ? (
            <p className="rounded-xl bg-muted px-3 py-2 text-sm">
              Your profile is private. Only you can see this page.
            </p>
          ) : null}
          <StatCards stats={map.stats} />
        </div>
      }
      map={
        <MapView
          pins={map.pins}
          countries={map.countries}
          label={`Map of books ${name} has read`}
          showLegend
        />
      }
    >
      <RecentlyRead entries={entries} />
      <Panel>
        <PlaceList map={map} emptyText="No books read yet." />
      </Panel>
      <section id="shelf" aria-labelledby="public-shelf-title" className="scroll-mt-24 space-y-3">
        <h2 id="public-shelf-title" className="text-lg font-semibold">
          Shelf
        </h2>
        <ReadOnlyShelf entries={entries} />
      </section>
    </ReadingMapLayout>
  );
}
