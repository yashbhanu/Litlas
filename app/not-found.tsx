import { MapPinOffIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <MapPinOffIcon aria-hidden className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Off the map</h1>
      <p className="text-muted-foreground">
        This page could not be found. The book, place or reader may have moved or never existed.
      </p>
      <div className="flex gap-2">
        <Link
          href="/explore"
          className={cn(buttonVariants({ size: "lg" }), "h-10 rounded-xl px-4")}
        >
          Explore the map
        </Link>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 rounded-xl px-4")}
        >
          Home
        </Link>
      </div>
    </main>
  );
}
