import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation/auth";
import { suggestUsername } from "@/lib/validation/profile";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Pick a username" };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pick a username</h1>
        <p className="text-sm text-muted-foreground">
          It appears in your public profile link. You can change your display name later.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <Onboarding searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Onboarding({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(typeof rawNext === "string" ? rawNext : null);

  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  if (await getProfile(user.id)) redirect(next);

  return <OnboardingForm suggestedUsername={suggestUsername(user.email)} next={next} />;
}
