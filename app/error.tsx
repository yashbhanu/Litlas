"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Error boundary for every page under the root layout (header and footer stay). */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon aria-hidden className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">
        This page hit an unexpected error. Try again, or head back to the map.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">Error {error.digest}</p>
      ) : null}
      <div className="flex gap-2">
        <Button size="lg" className="h-10 rounded-xl px-4" onClick={() => retry()}>
          <RotateCcwIcon aria-hidden />
          Try again
        </Button>
        <Link
          href="/explore"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 rounded-xl px-4")}
        >
          Explore the map
        </Link>
      </div>
    </main>
  );
}
