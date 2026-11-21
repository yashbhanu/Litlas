"use client";

import { LogOutIcon, MapPinIcon, ShieldCheckIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  username,
  displayName,
  isAdmin,
}: {
  username: string;
  displayName: string | null;
  isAdmin: boolean;
}) {
  const initial = (displayName ?? username).charAt(0).toUpperCase();
  return (
    <>
      {isAdmin ? (
        <Link
          href="/moderate"
          className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground md:inline"
        >
          Moderate
        </Link>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="flex size-10 items-center justify-center rounded-full bg-secondary font-heading text-sm font-semibold text-secondary-foreground outline-none hover:ring-2 hover:ring-ring/30 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {initial}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate font-medium text-foreground">
                {displayName ?? `@${username}`}
              </span>
              {displayName ? <span className="block truncate text-xs">@{username}</span> : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/me" />}>
            <MapPinIcon aria-hidden />
            My map
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/u/${username}`} />}>
            <UserIcon aria-hidden />
            Public profile
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem render={<Link href="/moderate" />}>
              <ShieldCheckIcon aria-hidden />
              Moderate
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <form action="/auth/signout" method="post">
            <DropdownMenuItem render={<button type="submit" className="w-full" />}>
              <LogOutIcon aria-hidden />
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
