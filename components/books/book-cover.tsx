import { BookIcon } from "lucide-react";
import Image from "next/image";
import { coverUrl } from "@/lib/books/cover";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { width: 40, height: 60, ol: "S" },
  md: { width: 64, height: 96, ol: "M" },
  lg: { width: 160, height: 240, ol: "L" },
} as const;

/**
 * Open Library cover with a placeholder when missing. Served unoptimized: Open Library
 * already provides sized images, and this keeps us within the Vercel Hobby image quota.
 */
export function BookCover({
  coverId,
  title,
  size = "md",
  className,
}: {
  coverId: number | null;
  title: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { width, height, ol } = SIZES[size];
  const box = cn("shrink-0 rounded-sm bg-muted", className);

  if (!coverId) {
    return (
      <div
        role="img"
        aria-label={`No cover available for ${title}`}
        className={cn(box, "flex items-center justify-center text-muted-foreground")}
        style={{ width, height }}
      >
        <BookIcon className="size-4" aria-hidden />
      </div>
    );
  }

  return (
    <Image
      src={coverUrl(coverId, ol)}
      alt={`Cover of ${title}`}
      width={width}
      height={height}
      unoptimized
      className={cn(box, "object-cover")}
      style={{ width, height }}
    />
  );
}
