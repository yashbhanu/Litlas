"use client";

import { GlobeIcon, MapPinIcon, PlusIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Bottom navigation on phones (hidden from md up, where the header has these links).
 * Reads the URL for the active tab, so render it inside <Suspense>.
 */
export function MobileTabBar({ username }: { username: string | null }) {
  return <TabLinks username={username} pathname={usePathname()} />;
}

/** The tabs without reading the URL (Suspense fallback / static shell). */
export function TabLinks({ username, pathname }: { username: string | null; pathname: string }) {
  const profile = username ? `/u/${username}` : "/login";
  const tabs = [
    { href: "/explore", label: "Explore", icon: GlobeIcon },
    { href: "/me", label: "My map", icon: MapPinIcon },
    { href: "/add", label: "Add book", icon: PlusIcon },
    { href: profile, label: "Profile", icon: UserIcon },
  ];
  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground outline-none focus-visible:bg-muted",
              active && "text-primary",
            )}
          >
            <Icon aria-hidden className="size-5" strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
