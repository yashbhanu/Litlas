import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Server-rendered pagination links (?page=N) for place pages. */
export function PaginationLinks({
  page,
  pageCount,
  href,
}: {
  page: number;
  pageCount: number;
  href: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={cn(linkClass, "pointer-events-none opacity-50")} aria-disabled>
          Previous
        </span>
      )}
      <span className="text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={linkClass} rel="next">
          Next
        </Link>
      ) : (
        <span className={cn(linkClass, "pointer-events-none opacity-50")} aria-disabled>
          Next
        </span>
      )}
    </nav>
  );
}
