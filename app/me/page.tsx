import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddBookDialog } from "@/components/books/add-book-dialog";
import { ShelfList } from "@/components/books/shelf-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/db/server";
import { listShelf } from "@/lib/db/shelf";

export const metadata: Metadata = { title: "My shelf" };

export default function MePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <Suspense fallback={<MeSkeleton />}>
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

  const entries = await listShelf(await createSupabaseServerClient(), user.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My shelf</h1>
          <p className="text-sm text-muted-foreground">
            {profile.displayName ? `${profile.displayName} · ` : ""}@{profile.username}
          </p>
        </div>
        <AddBookDialog />
      </div>
      <ShelfList entries={entries} />
    </>
  );
}

function MeSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading your shelf">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
