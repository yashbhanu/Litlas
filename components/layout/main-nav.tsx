"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/me", label: "My map" },
] as const;

/** Main nav with the current page highlighted. Render inside <Suspense> (request data). */
export function MainNav({ className }: { className?: string }) {
  return <NavLinks className={className} pathname={usePathname()} />;
}

/** The links without reading the URL (Suspense fallback / static shell). */
export function NavLinks({ className, pathname }: { className?: string; pathname: string }) {
  return (
    <nav aria-label="Main" className={cn("items-center gap-1", className)}>
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40",
              active && "bg-secondary text-secondary-foreground hover:bg-secondary",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
