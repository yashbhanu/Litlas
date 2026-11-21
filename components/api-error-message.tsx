"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ApiRequestError } from "@/lib/api-client";

/** An API error, with a sign-in / pick-a-username link when that's what's needed. */
export function ApiErrorMessage({ error }: { error: Error }) {
  const pathname = usePathname();
  const code = error instanceof ApiRequestError ? error.code : null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error.message}{" "}
      {code === "unauthorized" ? (
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="underline">
          Sign in
        </Link>
      ) : code === "profile_required" ? (
        <Link href={`/onboarding?next=${encodeURIComponent(pathname)}`} className="underline">
          Pick a username
        </Link>
      ) : null}
    </p>
  );
}
