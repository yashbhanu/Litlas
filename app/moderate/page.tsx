import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ModerationQueue } from "@/components/locations/moderation-queue";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { isAdmin, loadModerationQueue } from "@/lib/db/locations";

export const metadata: Metadata = { title: "Moderate", robots: { index: false } };

/** Admin queue: pending location suggestions — approve, reject, or merge duplicates. */
export default function ModeratePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Moderation</h1>
        <p className="text-sm text-muted-foreground">
          Pending location suggestions, oldest first. Approving puts a location on the map; merging
          moves a suggestion onto an existing place and deletes the duplicate.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Queue />
      </Suspense>
    </main>
  );
}

async function Queue() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/moderate");
  const admin = createSupabaseAdminClient();
  // Admin checks use the service role; non-admins get a 404 rather than a hint.
  if (!(await isAdmin(admin, user.id))) notFound();
  return <ModerationQueue items={await loadModerationQueue(admin)} />;
}
