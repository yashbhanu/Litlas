import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, getSessionUser } from "@/lib/auth";
import { AddBookPageFlow } from "./add-book-page-flow";

export const metadata: Metadata = { title: "Add a book" };

/** Full-page version of the add-book dialog (deep links, small screens). */
export default function AddPage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add a book</h1>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <AddGate />
      </Suspense>
    </main>
  );
}

async function AddGate() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/add");
  if (!(await getProfile(user.id))) redirect("/onboarding?next=/add");
  return <AddBookPageFlow />;
}
