import { GlobeIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AddBookDialog } from "@/components/books/add-book-dialog";
import { GlobalSearch } from "@/components/layout/global-search";
import { MainNav, NavLinks } from "@/components/layout/main-nav";
import { MobileTabBar, TabLinks } from "@/components/layout/mobile-tab-bar";
import { UserMenu } from "@/components/layout/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { isAdmin } from "@/lib/db/locations";
import { cn } from "@/lib/utils";

const addButton = cn(buttonVariants({ size: "lg" }), "h-10 rounded-xl px-4");

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 h-(--app-header) border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex h-full items-center gap-2 px-4 lg:gap-4 lg:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg font-heading text-[17px] font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <GlobeIcon aria-hidden className="size-6 text-primary" strokeWidth={1.75} />
          Literary World Map
        </Link>
        {/* usePathname (active link) is request data: keep it out of the static shell. */}
        <Suspense fallback={<NavLinks className="ml-4 hidden md:flex" pathname="" />}>
          <MainNav className="ml-4 hidden md:flex" />
        </Suspense>
        <div className="ml-auto flex items-center gap-2 lg:gap-3">
          <GlobalSearch className="hidden w-64 md:block lg:w-96" />
          <Suspense fallback={<Skeleton className="h-10 w-36 rounded-xl" />}>
            <HeaderActions />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function HeaderActions() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-10 rounded-xl")}
        >
          Sign in
        </Link>
        <Link href="/add" className={cn(addButton, "hidden md:inline-flex")}>
          <PlusIcon aria-hidden />
          Add a book
        </Link>
      </>
    );
  }
  const profile = await getProfile(user.id);
  if (!profile) {
    return (
      <Link href="/onboarding" className={addButton}>
        Pick a username
      </Link>
    );
  }
  const admin = await isAdmin(createSupabaseAdminClient(), user.id);
  return (
    <>
      <div className="hidden md:block">
        <AddBookDialog triggerClassName={addButton} />
      </div>
      <UserMenu username={profile.username} displayName={profile.displayName} isAdmin={admin} />
    </>
  );
}

/** Phone tab bar, with the signed-in user's profile link. */
export function SiteTabBar() {
  return (
    <Suspense fallback={<TabLinks username={null} pathname="" />}>
      <TabBarWithUser />
    </Suspense>
  );
}

async function TabBarWithUser() {
  const user = await getSessionUser();
  const profile = user ? await getProfile(user.id) : null;
  return <MobileTabBar username={profile?.username ?? null} />;
}
