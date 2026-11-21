import Image from "next/image";
import { coverUrl } from "@/lib/books/cover";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { width: 40, height: 56, ol: "S" },
  md: { width: 56, height: 80, ol: "M" },
  lg: { width: 168, height: 252, ol: "L" },
} as const;

/** Muted book-cloth colours for books without a cover (see UI mockups). */
const CLOTH = [
  "#c9a227",
  "#b85238",
  "#2e4756",
  "#7a5c8e",
  "#5e7a3a",
  "#0f766e",
  "#8a5a3b",
  "#3d5a80",
];

function clothColor(title: string): string {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CLOTH[hash % CLOTH.length]!;
}

/**
 * Open Library cover, or a coloured "cloth" placeholder when there is none. Served
 * unoptimized: Open Library already provides sized images, and this keeps us within the
 * Vercel Hobby image quota.
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
  const box = cn(
    "shrink-0 rounded-[6px] shadow-[0_1px_2px_rgb(0_0_0/0.12),inset_-2px_0_0_rgb(0_0_0/0.12)]",
    size === "lg" && "rounded-lg shadow-md",
    className,
  );

  if (!coverId) {
    return (
      <div
        role="img"
        aria-label={`No cover available for ${title}`}
        className={cn(box, "flex items-end overflow-hidden p-1.5")}
        style={{ width, height, background: clothColor(title) }}
      >
        {size === "lg" ? (
          <span className="line-clamp-4 font-heading text-lg leading-tight font-semibold text-white/90">
            {title}
          </span>
        ) : null}
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
      className={cn(box, "bg-muted object-cover")}
      style={{ width, height }}
    />
  );
}
