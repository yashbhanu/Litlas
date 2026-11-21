import type { ReactNode } from "react";

/**
 * Personal / public reading map page. On desktop the grid has a fixed height and doesn't
 * flex: as a flex item it would otherwise grow to fit the panel's content (min-height:
 * auto), making the map taller than the screen.
 *
 * Phones: one scrolling column (header and stats,
 * a map card, then the rest). Desktop: a full-height map with a scrolling side panel.
 */
export function ReadingMapLayout({
  head,
  map,
  children,
  panelLabel,
}: {
  head: ReactNode;
  map: ReactNode;
  children: ReactNode;
  panelLabel: string;
}) {
  return (
    <div className="grid flex-1 gap-5 bg-surface px-4 py-5 [grid-template-areas:'head'_'map'_'rest'] lg:h-[calc(100dvh-var(--app-header))] lg:min-h-0 lg:flex-none lg:grid-cols-[minmax(0,1fr)_460px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0 lg:bg-background lg:p-0 lg:[grid-template-areas:'map_head'_'map_rest']">
      <div className="[grid-area:head] lg:border-l lg:px-6 lg:pt-6 lg:pb-5">{head}</div>
      <div className="h-[340px] overflow-hidden rounded-2xl border bg-background shadow-xs [grid-area:map] sm:h-[420px] lg:h-auto lg:rounded-none lg:border-0 lg:shadow-none">
        {map}
      </div>
      <section
        aria-label={panelLabel}
        className="space-y-5 [grid-area:rest] lg:overflow-y-auto lg:border-l lg:px-6 lg:pb-8"
      >
        {children}
      </section>
    </div>
  );
}

/** Rounded white card for sections on the reading map page. */
export function Panel({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      className={`rounded-2xl border bg-background p-4 shadow-xs lg:shadow-none ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
