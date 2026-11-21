import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { isAdmin } from "@/lib/db/locations";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-1 sm:gap-4">
          <Link href="/" className="font-semibold tracking-tight">
            Literary World Map
          </Link>
          <Link href="/explore" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Explore
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-8 w-24" />}>
          <UserNav />
        </Suspense>
      </div>
    </header>
  );
}

async function UserNav() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <Link href="/login" className={buttonVariants({ size: "sm" })}>
        Sign in
      </Link>
    );
  }

  const profile = await getProfile(user.id);
  const admin = profile ? await isAdmin(createSupabaseAdminClient(), user.id) : false;
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      {admin ? (
        <Link href="/moderate" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Moderate
        </Link>
      ) : null}
      {profile ? (
        <Link href="/me" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          My map
        </Link>
      ) : (
        <Link href="/onboarding" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Pick a username
        </Link>
      )}
      <form action="/auth/signout" method="post">
        <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Sign out
        </button>
      </form>
    </nav>
  );
}
