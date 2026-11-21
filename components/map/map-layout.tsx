"use client";

import { ChevronUpIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-height map with a side panel on desktop (lg+) and a bottom sheet on smaller
 * screens. The sheet starts at 45% of the height and expands to 85%.
 */
export function MapLayout({
  map,
  panelLabel,
  children,
}: {
  map: ReactNode;
  panelLabel: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    // 57px = site header (h-14 + 1px border).
    <div className="flex h-[calc(100dvh-57px)] min-h-[480px] flex-col lg:flex-row">
      <div className="relative min-h-0 flex-1">{map}</div>
      <aside
        aria-label={panelLabel}
        data-expanded={expanded}
        className={cn(
          "flex flex-col rounded-t-xl border-t bg-background shadow-[0_-4px_16px_rgb(0_0_0/0.08)] transition-[height] duration-200",
          expanded ? "h-[85%]" : "h-[45%]",
          "lg:h-auto lg:w-[420px] lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex w-full flex-col items-center gap-1 rounded-t-xl pt-2 pb-1 text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          <span className="flex items-center gap-1">
            <ChevronUpIcon
              aria-hidden
              className={cn("size-3 transition-transform", expanded && "rotate-180")}
            />
            {expanded ? "Show more map" : "Expand list"}
          </span>
        </button>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 pt-2 lg:pt-4">{children}</div>
      </aside>
    </div>
  );
}
